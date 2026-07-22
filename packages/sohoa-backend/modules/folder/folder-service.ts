import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Static } from "elysia";
import {
  activeDossierWhere,
  activeFolderWhere,
} from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { AssignmentStatus } from "../../db/schemas/workflow-constants.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import {
  findWorkableEditorAssignment,
  resolveDossierDraftKey,
} from "../data-entry/metadata-draft-service.ts";
import {
  getRawStoragePrefix,
  toSearchablePdfKey,
} from "../dossier/dossier-path-utils.ts";
import { FolderBrowseNodeType } from "./folder-browse-constants.ts";
import type { FolderBrowseScope } from "./folder-browse-scope.ts";
import {
  assignFolderProjectBodySchema,
  createFolderSchema,
  folderEntitySchema,
  updateFolderSchema,
} from "./types.ts";
import { ProjectService } from "../project/project-service.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const crud = createCrudService({
  db,
  table: folders,
  searchable: ["folderName", "folderPath"],
  entitySchema: folderEntitySchema,
  createSchema: createFolderSchema,
  updateSchema: updateFolderSchema,
  defaultWith: {
    parent: true,
    children: true,
    dossiers: true,
  },
  metadata: {
    tags: ["Folder"],
    descriptions: {
      list: "List folders with pagination, filtering and search.",
      get: "Get a folder by ID with parent, children and dossiers.",
      create: "Create a folder record.",
      update: "Update a folder record.",
      delete: "Delete a folder record.",
    },
  },
});

function rawRootPath(): string {
  return getRawStoragePrefix();
}

function unscopedRawRootWhere(): SQL {
  return and(
    isNull(folders.projectCode),
    eq(folders.folderPath, rawRootPath()),
  )!;
}

function isUnscopedRawRoot(folder: {
  projectCode: string | null;
  folderPath: string;
}): boolean {
  return folder.projectCode === null && folder.folderPath === rawRootPath();
}

/**
 * When browsing by project, include records scoped to that project and the
 * shared raw/ root container (folderPath == raw prefix, projectCode null).
 * Unassigned raw subfolders (projectCode null under raw/) are excluded.
 */
function folderProjectWhere(projectCode: string): SQL {
  return or(
    eq(folders.projectCode, projectCode),
    unscopedRawRootWhere(),
  )!;
}

function dossierProjectWhere(projectCode: string): SQL {
  return eq(dossiers.projectCode, projectCode);
}

function assertFolderMatchesProject(
  folder: { projectCode: string | null; folderPath: string },
  projectCode: string,
) {
  if (isUnscopedRawRoot(folder)) {
    return;
  }
  if (folder.projectCode !== projectCode) {
    throw httpError.notFound("Folder not found");
  }
}

/**
 * Folder filter for a resolved browse scope. `global` browses everything,
 * `single` reuses the single-project filter, and `managed` restricts to the
 * caller's managed projects plus the shared raw/ root container. Unassigned
 * raw subfolders are only visible under `global`. An empty managed scope
 * matches nothing.
 */
function folderBrowseWhere(scope: FolderBrowseScope): SQL | undefined {
  if (scope.mode === "global") {
    return undefined;
  }
  if (scope.mode === "single") {
    return folderProjectWhere(scope.projectCode);
  }
  if (scope.projectCodes.length === 0) {
    return sql`false`;
  }
  return or(
    inArray(folders.projectCode, scope.projectCodes),
    unscopedRawRootWhere(),
  )!;
}

/** Dossier counterpart of {@link folderBrowseWhere}. */
function dossierBrowseWhere(scope: FolderBrowseScope): SQL | undefined {
  if (scope.mode === "global") {
    return undefined;
  }
  if (scope.mode === "single") {
    return dossierProjectWhere(scope.projectCode);
  }
  if (scope.projectCodes.length === 0) {
    return sql`false`;
  }
  return inArray(dossiers.projectCode, scope.projectCodes);
}

/** Ensure the requested root folder is visible under the browse scope. */
function assertFolderMatchesBrowseScope(
  folder: { projectCode: string | null; folderPath: string },
  scope: FolderBrowseScope,
) {
  if (scope.mode === "global") {
    return;
  }
  if (scope.mode === "single") {
    assertFolderMatchesProject(folder, scope.projectCode);
    return;
  }
  if (isUnscopedRawRoot(folder)) {
    return;
  }
  if (folder.projectCode === null) {
    throw httpError.notFound("Folder not found");
  }
  if (!scope.projectCodes.includes(folder.projectCode)) {
    throw httpError.notFound("Folder not found");
  }
}

async function loadDirectFileSizeKbByFolderId(scope: FolderBrowseScope) {
  const rows = await db
    .select({
      folderId: dossiers.folderId,
      totalSizeKb:
        sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(
          Number,
        ),
    })
    .from(dossiers)
    .innerJoin(dossierFiles, eq(dossierFiles.dossierId, dossiers.id))
    .where(activeDossierWhere(dossierBrowseWhere(scope)))
    .groupBy(dossiers.folderId);

  return new Map(rows.map((row) => [row.folderId, row.totalSizeKb]));
}

function buildFolderChildrenByParentId(
  allFolders: Array<{ id: string; parentId: string | null }>,
) {
  const childrenByParentId = new Map<string, string[]>();

  for (const folder of allFolders) {
    if (!folder.parentId) {
      continue;
    }

    const list = childrenByParentId.get(folder.parentId) ?? [];
    list.push(folder.id);
    childrenByParentId.set(folder.parentId, list);
  }

  return childrenByParentId;
}

type FolderSizeIndex = {
  childrenByParentId: Map<string, string[]>;
  directSizeByFolderId: Map<string, number>;
  sizeCache: Map<string, number>;
};

function getRecursiveFolderSizeKb(
  folderId: string,
  index: FolderSizeIndex,
): number {
  const cached = index.sizeCache.get(folderId);
  if (cached !== undefined) {
    return cached;
  }

  let total = index.directSizeByFolderId.get(folderId) ?? 0;
  for (const childId of index.childrenByParentId.get(folderId) ?? []) {
    total += getRecursiveFolderSizeKb(childId, index);
  }

  index.sizeCache.set(folderId, total);
  return total;
}

async function sumRecursiveFileSizeKbByFolderIds(
  rootFolderIds: string[],
  scope: FolderBrowseScope,
) {
  if (rootFolderIds.length === 0) {
    return new Map<string, number>();
  }

  const [allFolders, directSizeByFolderId] = await Promise.all([
    db.query.folders.findMany({
      where: activeFolderWhere(folderBrowseWhere(scope)),
      columns: { id: true, parentId: true },
    }),
    loadDirectFileSizeKbByFolderId(scope),
  ]);

  const index: FolderSizeIndex = {
    childrenByParentId: buildFolderChildrenByParentId(allFolders),
    directSizeByFolderId,
    sizeCache: new Map(),
  };

  return new Map(
    rootFolderIds.map((folderId) => [
      folderId,
      getRecursiveFolderSizeKb(folderId, index),
    ]),
  );
}

async function sumFileSizeKbByDossierIds(dossierIds: string[]) {
  if (dossierIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await db
    .select({
      dossierId: dossierFiles.dossierId,
      totalSizeKb:
        sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(
          Number,
        ),
    })
    .from(dossierFiles)
    .where(inArray(dossierFiles.dossierId, dossierIds))
    .groupBy(dossierFiles.dossierId);

  return new Map(rows.map((row) => [row.dossierId, row.totalSizeKb]));
}

function isDossierAssigned(
  dossier: { id: string; assignedGroupId: string | null },
  dossierIdsWithAssignments: Set<string>,
) {
  return (
    dossier.assignedGroupId != null || dossierIdsWithAssignments.has(dossier.id)
  );
}

function getDescendantFolderIds(
  folderId: string,
  childrenByParentId: Map<string, string[]>,
  descendantCache: Map<string, string[]>,
): string[] {
  const cached = descendantCache.get(folderId);
  if (cached !== undefined) {
    return cached;
  }

  const ids = [folderId];
  for (const childId of childrenByParentId.get(folderId) ?? []) {
    ids.push(
      ...getDescendantFolderIds(childId, childrenByParentId, descendantCache),
    );
  }

  descendantCache.set(folderId, ids);
  return ids;
}

function isFolderSubtreeFullyAssigned(
  folderId: string,
  childrenByParentId: Map<string, string[]>,
  dossiersByFolderId: Map<
    string,
    Array<{ id: string; assignedGroupId: string | null }>
  >,
  dossierIdsWithAssignments: Set<string>,
  descendantCache: Map<string, string[]>,
): boolean {
  const subtreeDossiers = getDescendantFolderIds(
    folderId,
    childrenByParentId,
    descendantCache,
  ).flatMap((id) => dossiersByFolderId.get(id) ?? []);

  if (subtreeDossiers.length === 0) {
    return false;
  }

  return subtreeDossiers.every((dossier) =>
    isDossierAssigned(dossier, dossierIdsWithAssignments),
  );
}

async function loadDossierIdsWithAssignments(dossierIds: string[]) {
  if (dossierIds.length === 0) {
    return new Set<string>();
  }

  const rows = await db
    .selectDistinct({ dossierId: dossierAssignments.dossierId })
    .from(dossierAssignments)
    .where(
      and(
        inArray(dossierAssignments.dossierId, dossierIds),
        ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
      ),
    );

  return new Set(rows.map((row) => row.dossierId));
}

async function listAllParents(scope: FolderBrowseScope) {
  const children = await db.query.folders.findMany({
    where: activeFolderWhere(
      isNull(folders.parentId),
      folderBrowseWhere(scope),
    ),
    orderBy: asc(folders.folderName),
  });

  return {
    nodeType: FolderBrowseNodeType.FOLDER,
    projectCode: scopeResponseProjectCode(scope),
    children,
  };
}

function scopeResponseProjectCode(scope: FolderBrowseScope): string | null {
  return scope.mode === "single" ? scope.projectCode : null;
}

async function listAllFirstSubfolders(
  folderId: string,
  scope: FolderBrowseScope,
) {
  const responseProjectCode = scopeResponseProjectCode(scope);
  const folder = await db.query.folders.findFirst({
    where: activeFolderWhere(eq(folders.id, folderId)),
  });

  if (!folder) {
    throw httpError.notFound("Folder not found");
  }

  assertFolderMatchesBrowseScope(folder, scope);

  const subfolders = await db.query.folders.findMany({
    where: activeFolderWhere(
      eq(folders.parentId, folderId),
      folderBrowseWhere(scope),
    ),
    orderBy: asc(folders.folderName),
  });

  if (subfolders.length > 0) {
    const subfolderIds = subfolders.map((folder) => folder.id);
    const [allFolders, allDossiers, sizeKbByFolderId] = await Promise.all([
      db.query.folders.findMany({
        where: activeFolderWhere(folderBrowseWhere(scope)),
        columns: { id: true, parentId: true },
      }),
      db.query.dossiers.findMany({
        where: activeDossierWhere(dossierBrowseWhere(scope)),
        orderBy: asc(dossiers.name),
      }),
      sumRecursiveFileSizeKbByFolderIds(subfolderIds, scope),
    ]);

    const childrenByParentId = buildFolderChildrenByParentId(allFolders);
    const descendantCache = new Map<string, string[]>();
    const dossiersByFolderId = new Map<
      string,
      (typeof allDossiers)[number][]
    >();

    for (const dossier of allDossiers) {
      const list = dossiersByFolderId.get(dossier.folderId) ?? [];
      list.push(dossier);
      dossiersByFolderId.set(dossier.folderId, list);
    }

    const subtreeDossierIds = subfolderIds.flatMap((id) =>
      getDescendantFolderIds(id, childrenByParentId, descendantCache).flatMap(
        (folderId) =>
          (dossiersByFolderId.get(folderId) ?? []).map((dossier) => dossier.id),
      ),
    );

    const dossierIdsWithAssignments =
      await loadDossierIdsWithAssignments(subtreeDossierIds);

    const directDossierByFolderId = new Map<
      string,
      (typeof allDossiers)[number]
    >();
    for (const subfolderId of subfolderIds) {
      const directDossier = dossiersByFolderId.get(subfolderId)?.[0];
      if (directDossier) {
        directDossierByFolderId.set(subfolderId, directDossier);
      }
    }

    const children = subfolders.map((folder) => {
      const totalSizeKb = sizeKbByFolderId.get(folder.id) ?? 0;
      const isAssigned = isFolderSubtreeFullyAssigned(
        folder.id,
        childrenByParentId,
        dossiersByFolderId,
        dossierIdsWithAssignments,
        descendantCache,
      );
      const directDossier = directDossierByFolderId.get(folder.id);

      if (!directDossier) {
        return { ...folder, totalSizeKb, isAssigned };
      }

      return {
        ...folder,
        dossierId: directDossier.id,
        status: directDossier.status,
        isAssigned,
        totalSizeKb,
      };
    });

    return {
      nodeType: FolderBrowseNodeType.FOLDER,
      parentId: folderId,
      projectCode: responseProjectCode,
      totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
      children,
    };
  }

  const folderDossiers = await db.query.dossiers.findMany({
    where: activeDossierWhere(
      eq(dossiers.folderId, folderId),
      dossierBrowseWhere(scope),
    ),
    orderBy: asc(dossiers.name),
  });

  const dossierIds = folderDossiers.map((d) => d.id);
  const [sizeKbByDossierId, dossierIdsWithAssignments] = await Promise.all([
    sumFileSizeKbByDossierIds(dossierIds),
    loadDossierIdsWithAssignments(dossierIds),
  ]);

  const children = folderDossiers.map((d) => ({
    id: d.id,
    folderId: d.folderId,
    folderPath: d.folderPath,
    name: d.name,
    entityType: d.entityType,
    status: d.status,
    isAssigned: isDossierAssigned(d, dossierIdsWithAssignments),
    totalSizeKb: sizeKbByDossierId.get(d.id) ?? 0,
  }));

  return {
    nodeType: FolderBrowseNodeType.DOSSIER,
    parentId: folderId,
    projectCode: responseProjectCode,
    totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
    children,
  };
}

async function listDossierFiles(
  dossierId: string,
  options?: { actorId?: string; status?: "draft" },
) {
  const dossier = await db.query.dossiers.findFirst({
    where: activeDossierWhere(eq(dossiers.id, dossierId)),
  });

  if (!dossier) {
    throw httpError.notFound("Dossier not found");
  }

  const loadDraft = options?.status === "draft";
  const assignment =
    loadDraft && options?.actorId
      ? await findWorkableEditorAssignment(dossierId, options.actorId)
      : null;

  const files = await db.query.dossierFiles.findMany({
    where: eq(dossierFiles.dossierId, dossierId),
    orderBy: asc(dossierFiles.fileName),
  });

  const children = await Promise.all(
    files.map(async (file) => {
      const searchablePdfPath = toSearchablePdfKey(file.filePath);
      return {
        ...file,
        fileUrl: (await buildLinkGet(file.filePath)) ?? "",
        searchablePdfPath,
        searchablePdfUrl: searchablePdfPath
          ? ((await buildLinkGet(searchablePdfPath)) ?? "")
          : null,
      };
    }),
  );

  const rawMetadataKey = loadDraft
    ? resolveDossierDraftKey({
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
      })
    : dossier.currentMetadataKey;
  const metadataKeyJson =
    rawMetadataKey && !rawMetadataKey.endsWith(".json")
      ? `${rawMetadataKey}.json`
      : rawMetadataKey;
  const currentMetadataUrl = await buildLinkGet(metadataKeyJson);

  return {
    nodeType: FolderBrowseNodeType.FILE,
    dossierId,
    currentMetadataUrl,
    ...(loadDraft && assignment
      ? {
          assignment: {
            id: assignment.id,
            status: assignment.status,
            role: assignment.role,
          },
        }
      : {}),
    children,
  };
}

async function collectDescendantFolderIds(
  tx: DbTx,
  rootFolderId: string,
): Promise<string[]> {
  const ids = [rootFolderId];
  let frontier = [rootFolderId];

  while (frontier.length > 0) {
    const children = await tx
      .select({ id: folders.id })
      .from(folders)
      .where(activeFolderWhere(inArray(folders.parentId, frontier)));

    const childIds = children.map((child) => child.id);
    if (childIds.length === 0) {
      break;
    }

    ids.push(...childIds);
    frontier = childIds;
  }

  return ids;
}

async function loadDossierIdsWithAssignmentsInTx(
  tx: DbTx,
  dossierIds: string[],
) {
  if (dossierIds.length === 0) {
    return new Set<string>();
  }

  const rows = await tx
    .selectDistinct({ dossierId: dossierAssignments.dossierId })
    .from(dossierAssignments)
    .where(
      and(
        inArray(dossierAssignments.dossierId, dossierIds),
        ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
      ),
    );

  return new Set(rows.map((row) => row.dossierId));
}

async function assertFolderSubtreeHasNoAssignments(
  tx: DbTx,
  folderId: string,
) {
  const descendantFolderIds = await collectDescendantFolderIds(tx, folderId);
  const dossierRows = await tx
    .select({
      id: dossiers.id,
      assignedGroupId: dossiers.assignedGroupId,
    })
    .from(dossiers)
    .where(
      activeDossierWhere(inArray(dossiers.folderId, descendantFolderIds)),
    );

  const dossierIds = dossierRows.map((row) => row.id);
  const dossierIdsWithAssignments = await loadDossierIdsWithAssignmentsInTx(
    tx,
    dossierIds,
  );

  const hasAssignment = dossierRows.some((dossier) =>
    isDossierAssigned(dossier, dossierIdsWithAssignments),
  );

  if (hasAssignment) {
    throw httpError.conflict(
      "Không thể đổi dự án vì thư mục đã có phân công",
    );
  }
}

export const FolderService = {
  ...crud,

  async create(input: Static<typeof createFolderSchema>) {
    await ProjectService.assertProjectExists(input.projectCode);
    return await crud.create(input);
  },

  async update(id: string, input: Static<typeof updateFolderSchema>) {
    if (input.projectCode) {
      await ProjectService.assertProjectExists(input.projectCode);
    }
    return await crud.update(id, input);
  },

  async assignProject(
    folderId: string,
    input: Static<typeof assignFolderProjectBodySchema>,
  ) {
    const projectCode = input.projectCode.trim();
    await ProjectService.assertProjectExists(projectCode);

    return await db.transaction(async (tx) => {
      const folder = await tx.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
      });

      if (!folder) {
        throw httpError.notFound("Folder not found");
      }

      if (isUnscopedRawRoot(folder)) {
        throw httpError.badRequest(
          "Không thể gán dự án cho thư mục gốc raw/",
        );
      }

      if (folder.projectCode === projectCode) {
        return folder;
      }

      await assertFolderSubtreeHasNoAssignments(tx, folderId);

      const descendantFolderIds = await collectDescendantFolderIds(
        tx,
        folderId,
      );
      const now = new Date();

      await tx
        .update(folders)
        .set({ projectCode, updatedAt: now })
        .where(
          and(
            inArray(folders.id, descendantFolderIds),
            ne(folders.folderPath, rawRootPath()),
          ),
        );

      await tx
        .update(dossiers)
        .set({ projectCode, updatedAt: now })
        .where(inArray(dossiers.folderId, descendantFolderIds));

      const updated = await tx.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
      });

      if (!updated) {
        throw httpError.notFound("Folder not found");
      }

      return updated;
    });
  },

  listAllParents,
  listAllFirstSubfolders,
  listDossierFiles,
};
