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
import {
  AssignmentStatus,
  DossierStatus,
} from "../../db/schemas/workflow-constants.ts";
import {
  buildLinkGet,
  listJsonObjectsUnderPrefix,
} from "../data-entry/data-entry-s3-utils.ts";
import { resolveReadableMetadataStorageKey } from "../data-entry/load-dossier-metadata-json.ts";
import {
  findWorkableEditorAssignment,
  resolveDossierDraftKey,
} from "../data-entry/metadata-draft-service.ts";
import {
  getRawStoragePrefix,
  toSearchablePdfKey,
} from "../dossier/dossier-path-utils.ts";
import { assignFolderProjectCode } from "../dossier/dossier-service.ts";
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
  return or(eq(folders.projectCode, projectCode), unscopedRawRootWhere())!;
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

async function loadDirectDossierStatsByFolderId(scope: FolderBrowseScope) {
  const rows = await db
    .select({
      folderId: dossiers.folderId,
      totalSizeKb:
        sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
      fileCount: sql<number>`count(${dossierFiles.id})`.mapWith(Number),
      pageCount: sql<number>`coalesce(sum(${dossierFiles.pageCount}), 0)`.mapWith(Number),
    })
    .from(dossiers)
    .innerJoin(dossierFiles, eq(dossierFiles.dossierId, dossiers.id))
    .where(activeDossierWhere(dossierBrowseWhere(scope)))
    .groupBy(dossiers.folderId);

  return new Map(rows.map((row) => [row.folderId, row]));
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

type FolderStatsIndex = {
  childrenByParentId: Map<string, string[]>;
  directStatsByFolderId: Map<string, { totalSizeKb: number; fileCount: number; pageCount: number }>;
  statsCache: Map<string, { totalSizeKb: number; fileCount: number; pageCount: number }>;
};

function getRecursiveFolderStats(
  folderId: string,
  index: FolderStatsIndex,
): { totalSizeKb: number; fileCount: number; pageCount: number } {
  const cached = index.statsCache.get(folderId);
  if (cached !== undefined) {
    return cached;
  }

  const direct = index.directStatsByFolderId.get(folderId) ?? { totalSizeKb: 0, fileCount: 0, pageCount: 0 };
  let totalSizeKb = direct.totalSizeKb;
  let fileCount = direct.fileCount;
  let pageCount = direct.pageCount;

  for (const childId of index.childrenByParentId.get(folderId) ?? []) {
    const childStats = getRecursiveFolderStats(childId, index);
    totalSizeKb += childStats.totalSizeKb;
    fileCount += childStats.fileCount;
    pageCount += childStats.pageCount;
  }

  const result = { totalSizeKb, fileCount, pageCount };
  index.statsCache.set(folderId, result);
  return result;
}

async function sumRecursiveFolderStatsByFolderIds(
  rootFolderIds: string[],
  scope: FolderBrowseScope,
) {
  if (rootFolderIds.length === 0) {
    return new Map<string, { totalSizeKb: number; fileCount: number; pageCount: number }>();
  }

  const [allFolders, directStatsByFolderId] = await Promise.all([
    db.query.folders.findMany({
      where: activeFolderWhere(folderBrowseWhere(scope)),
      columns: { id: true, parentId: true },
    }),
    loadDirectDossierStatsByFolderId(scope),
  ]);

  const index: FolderStatsIndex = {
    childrenByParentId: buildFolderChildrenByParentId(allFolders),
    directStatsByFolderId,
    statsCache: new Map(),
  };

  return new Map(
    rootFolderIds.map((folderId) => [
      folderId,
      getRecursiveFolderStats(folderId, index),
    ]),
  );
}

async function sumDossierStatsByDossierIds(dossierIds: string[]) {
  if (dossierIds.length === 0) {
    return new Map<string, { totalSizeKb: number; fileCount: number; pageCount: number }>();
  }

  const rows = await db
    .select({
      dossierId: dossierFiles.dossierId,
      totalSizeKb:
        sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
      fileCount: sql<number>`count(${dossierFiles.id})`.mapWith(Number),
      pageCount: sql<number>`coalesce(sum(${dossierFiles.pageCount}), 0)`.mapWith(Number),
    })
    .from(dossierFiles)
    .where(inArray(dossierFiles.dossierId, dossierIds))
    .groupBy(dossierFiles.dossierId);

  return new Map(rows.map((row) => [row.dossierId, row]));
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

const VN_SOURCE = "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ";
const VN_TARGET = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function buildFuzzyTextCondition(col: any, q: string) {
  const trimmed = q.trim();
  const unaccented = removeVietnameseTones(trimmed);
  const cleanQ = unaccented.replace(/[^a-z0-9]/g, "");
  const rawLike = `%${trimmed}%`;
  const unaccentLike = `%${unaccented}%`;
  const colUnaccent = sql`translate(lower(${col}), ${VN_SOURCE}, ${VN_TARGET})`;
  const colClean = sql`regexp_replace(${colUnaccent}, '[^a-z0-9]', '', 'g')`;

  const conditions: any[] = [
    sql`${col} ILIKE ${rawLike}`,
    sql`${colUnaccent} LIKE ${unaccentLike}`,
  ];

  if (cleanQ.length >= 2) {
    conditions.push(sql`${colClean} LIKE ${`%${cleanQ}%`}`);
  }

  const tokens = unaccented.split(/[\s_\-\.]+/).filter(Boolean);
  if (tokens.length > 1) {
    const tokenConditions = tokens.map(t => sql`${colUnaccent} LIKE ${`%${t}%`}`);
    conditions.push(and(...tokenConditions)!);
  }

  return or(...conditions)!;
}

function buildFuzzyFileCondition(q: string) {
  const trimmed = q.trim();
  const unaccented = removeVietnameseTones(trimmed);
  const withoutExt = trimmed.replace(/\.pdf$/i, "").trim();
  const withoutExtUnaccented = removeVietnameseTones(withoutExt);
  const cleanQ = unaccented.replace(/[^a-z0-9]/g, "");
  const cleanWithoutExt = withoutExtUnaccented.replace(/[^a-z0-9]/g, "");
  const tokens = unaccented.split(/[\s_\-\.]+/).filter(Boolean);

  const rawLike = `%${trimmed}%`;
  const unaccentLike = `%${unaccented}%`;
  const rawWithoutExtLike = `%${withoutExt}%`;
  const unaccentWithoutExtLike = `%${withoutExtUnaccented}%`;

  const colName = dossierFiles.fileName;
  const colNameUnaccent = sql`translate(lower(${dossierFiles.fileName}), ${VN_SOURCE}, ${VN_TARGET})`;
  const colNameClean = sql`regexp_replace(${colNameUnaccent}, '[^a-z0-9]', '', 'g')`;

  // Only match the file basename from filePath (not the parent directory path!)
  const colFileBase = sql`substring(${dossierFiles.filePath} from '[^/]+$')`;
  const colFileBaseUnaccent = sql`translate(lower(substring(${dossierFiles.filePath} from '[^/]+$')), ${VN_SOURCE}, ${VN_TARGET})`;
  const colFileBaseClean = sql`regexp_replace(${colFileBaseUnaccent}, '[^a-z0-9]', '', 'g')`;

  const conditions: any[] = [
    sql`${colName} ILIKE ${rawLike}`,
    sql`${colName} ILIKE ${rawWithoutExtLike}`,
    sql`${colNameUnaccent} LIKE ${unaccentLike}`,
    sql`${colNameUnaccent} LIKE ${unaccentWithoutExtLike}`,
    sql`${colFileBase} ILIKE ${rawLike}`,
    sql`${colFileBase} ILIKE ${rawWithoutExtLike}`,
    sql`${colFileBaseUnaccent} LIKE ${unaccentLike}`,
    sql`${colFileBaseUnaccent} LIKE ${unaccentWithoutExtLike}`,
  ];

  if (cleanQ.length >= 2) {
    const cleanQLike = `%${cleanQ}%`;
    conditions.push(
      sql`${colNameClean} LIKE ${cleanQLike}`,
      sql`${colFileBaseClean} LIKE ${cleanQLike}`
    );
  }
  if (cleanWithoutExt.length >= 2 && cleanWithoutExt !== cleanQ) {
    const cleanWithoutExtLike = `%${cleanWithoutExt}%`;
    conditions.push(
      sql`${colNameClean} LIKE ${cleanWithoutExtLike}`,
      sql`${colFileBaseClean} LIKE ${cleanWithoutExtLike}`
    );
  }

  if (tokens.length > 1) {
    const tokenConditions = tokens.map(t => {
      const tLike = `%${t}%`;
      return or(
        sql`${colNameUnaccent} LIKE ${tLike}`,
        sql`${colFileBaseUnaccent} LIKE ${tLike}`
      )!;
    });
    conditions.push(and(...tokenConditions)!);
  }

  return or(...conditions)!;
}

async function searchTree(q: string, scope: FolderBrowseScope) {
  // 1. Find matched files (respecting dossier browse scope)
  const matchedFileRows = await db.query.dossierFiles.findMany({
    where: buildFuzzyFileCondition(q),
    columns: { id: true, dossierId: true, fileName: true, filePath: true, fileSizeKb: true, pageCount: true, createdAt: true },
    with: {
      dossier: {
        columns: { id: true, folderPath: true, folderId: true, projectCode: true, deletedAt: true },
      },
    },
  });

  const matchedFiles = matchedFileRows.filter((f) => {
    if (!f.dossier || f.dossier.deletedAt) return false;
    if (scope.mode === "global") return true;
    if (scope.mode === "single") return f.dossier.projectCode === scope.projectCode;
    if (scope.projectCodes.length === 0) return false;
    return f.dossier.projectCode && scope.projectCodes.includes(f.dossier.projectCode);
  });

  // 2. Find matched dossiers
  const matchedDossiers = await db.query.dossiers.findMany({
    where: and(
      activeDossierWhere(dossierBrowseWhere(scope)),
      buildFuzzyTextCondition(dossiers.name, q)
    )
  });

  // 3. Find matched folders
  const matchedFolders = await db.query.folders.findMany({
    where: and(
      activeFolderWhere(folderBrowseWhere(scope)),
      buildFuzzyTextCondition(folders.folderName, q)
    )
  });

  const dossierIdsToFetch = new Set<string>();
  const folderPathsToFetch = new Set<string>();

  for (const f of matchedFiles) {
    if (f.dossierId) {
      dossierIdsToFetch.add(f.dossierId);
      if (f.dossier?.folderPath) folderPathsToFetch.add(f.dossier.folderPath);
    }
  }
  for (const d of matchedDossiers) {
    dossierIdsToFetch.add(d.id);
    if (d.folderPath) folderPathsToFetch.add(d.folderPath);
  }
  for (const f of matchedFolders) {
    if (f.folderPath) folderPathsToFetch.add(f.folderPath);
  }

  // For matched folders, also find all descendant folders and their dossiers
  const descendantFolderConditions = matchedFolders
    .filter(f => f.folderPath)
    .map(f => sql`${folders.folderPath} LIKE ${f.folderPath + '/%'}`);

  const descendantFolders = descendantFolderConditions.length > 0
    ? await db.query.folders.findMany({
        where: and(
          activeFolderWhere(folderBrowseWhere(scope)),
          or(...descendantFolderConditions)
        ),
        orderBy: asc(folders.folderName)
      })
    : [];

  for (const df of descendantFolders) {
    if (df.folderPath) folderPathsToFetch.add(df.folderPath);
  }

  // Collect all folder IDs where dossiers could live (matched folders + their descendant folders)
  const allFolderIdsForDossiers = new Set<string>();
  for (const f of matchedFolders) allFolderIdsForDossiers.add(f.id);
  for (const df of descendantFolders) allFolderIdsForDossiers.add(df.id);

  const folderDossiers = allFolderIdsForDossiers.size > 0
    ? await db.query.dossiers.findMany({
        where: and(
          activeDossierWhere(dossierBrowseWhere(scope)),
          inArray(dossiers.folderId, Array.from(allFolderIdsForDossiers))
        ),
        orderBy: asc(dossiers.name)
      })
    : [];

  for (const d of folderDossiers) {
    dossierIdsToFetch.add(d.id);
    if (d.folderPath) folderPathsToFetch.add(d.folderPath);
  }

  // Generate ancestor folder paths
  const ancestorPaths = new Set<string>();
  for (const p of folderPathsToFetch) {
    const parts = p.split("/").filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      ancestorPaths.add(parts.slice(0, i + 1).join("/"));
    }
  }

  // Fetch all dossiers
  const allDossiers = dossierIdsToFetch.size > 0 
    ? await db.query.dossiers.findMany({
        where: inArray(dossiers.id, Array.from(dossierIdsToFetch)),
        orderBy: asc(dossiers.name)
      })
    : [];

  // Fetch all ancestor folders
  const allFolders = ancestorPaths.size > 0
    ? await db.query.folders.findMany({
        where: and(
          activeFolderWhere(folderBrowseWhere(scope)),
          inArray(folders.folderPath, Array.from(ancestorPaths))
        ),
        orderBy: asc(folders.folderName)
      })
    : [];

  // Assemble the tree
  const folderMap = new Map<string, any>();
  const rootFolders: any[] = [];

  for (const folder of allFolders) {
    const folderNode = { ...folder, children: [] };
    folderMap.set(folder.id, folderNode);
  }

  for (const folder of folderMap.values()) {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId).children.push(folder);
    } else {
      rootFolders.push(folder);
    }
  }

  // Map dossiers to their folders
  const dossierMap = new Map<string, any>();
  for (const dossier of allDossiers) {
    const dossierNode = {
      ...dossier,
      type: "record",
      entityType: "DOCUMENT",
      dossierId: dossier.id,
      children: [],
    };
    dossierMap.set(dossier.id, dossierNode);
    if (folderMap.has(dossier.folderId)) {
      folderMap.get(dossier.folderId).children.push(dossierNode);
    }
  }

  // Fetch ALL files for dossiers in the result tree
  const allDossierFiles = dossierIdsToFetch.size > 0
    ? await db.query.dossierFiles.findMany({
        where: inArray(dossierFiles.dossierId, Array.from(dossierIdsToFetch)),
        columns: { id: true, dossierId: true, fileName: true, filePath: true, fileSizeKb: true, pageCount: true, createdAt: true },
        orderBy: asc(dossierFiles.fileName),
      })
    : [];

  const directlyMatchedDossierIds = new Set<string>([
    ...matchedDossiers.map(d => d.id),
    ...folderDossiers.map(d => d.id),
  ]);
  const matchedFileIds = new Set<string>(matchedFiles.map(f => f.id));

  // Map files to their dossiers
  for (const file of allDossierFiles) {
    if (file.dossierId && dossierMap.has(file.dossierId)) {
      const isDirectDossierMatch = directlyMatchedDossierIds.has(file.dossierId);
      const isThisFileMatch = matchedFileIds.has(file.id);

      // If the dossier only appeared because of specific matched files,
      // include ONLY the file(s) that matched the query to keep the tree focused.
      if (!isDirectDossierMatch && !isThisFileMatch) {
        continue;
      }

      const extensionMatch = file.filePath.match(/\.[^.]+$/);
      let nameWithExt = file.fileName;
      if (extensionMatch && !nameWithExt.includes('.')) {
        nameWithExt = nameWithExt + extensionMatch[0];
      }

      dossierMap.get(file.dossierId).children.push({
        id: file.id,
        dossierId: file.dossierId,
        parentId: file.dossierId,
        name: nameWithExt,
        filePath: file.filePath,
        type: "document",
        entityType: "DOCUMENT",
        totalSizeKb: file.fileSizeKb,
        pageCount: file.pageCount,
        createdAt: file.createdAt,
        isSearchMatch: isThisFileMatch,
      });
    }
  }

  // Back-fill fileCount and totalSizeKb / pageCount on each dossier node
  for (const dossierNode of dossierMap.values()) {
    dossierNode.fileCount = dossierNode.children.length;
    dossierNode.totalSizeKb = dossierNode.children.reduce(
      (s: number, f: any) => s + (f.totalSizeKb ?? 0), 0
    );
    dossierNode.pageCount = dossierNode.children.reduce(
      (s: number, f: any) => s + (f.pageCount ?? 0), 0
    );
  }

  // Recursively compute folder stats bottom-up
  function computeFolderStats(node: any): { fileCount: number; pageCount: number; totalSizeKb: number } {
    let fileCount = 0;
    let pageCount = 0;
    let totalSizeKb = 0;

    for (const child of node.children) {
      if (child.type === 'document') {
        fileCount += 1;
        pageCount += child.pageCount ?? 0;
        totalSizeKb += child.totalSizeKb ?? 0;
      } else if (child.children && child.children.length > 0) {
        const childStats = computeFolderStats(child);
        fileCount += childStats.fileCount;
        pageCount += childStats.pageCount;
        totalSizeKb += childStats.totalSizeKb;
      } else {
        fileCount += child.fileCount ?? 0;
        pageCount += child.pageCount ?? 0;
        totalSizeKb += child.totalSizeKb ?? 0;
      }
    }

    node.fileCount = fileCount;
    node.pageCount = pageCount;
    node.totalSizeKb = totalSizeKb;
    return { fileCount, pageCount, totalSizeKb };
  }

  for (const root of rootFolders) {
    computeFolderStats(root);
  }

  return {
    nodeType: FolderBrowseNodeType.FOLDER,
    projectCode: scopeResponseProjectCode(scope),
    children: rootFolders,
  };
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
    const [allFolders, allDossiers, statsByFolderId] = await Promise.all([
      db.query.folders.findMany({
        where: activeFolderWhere(folderBrowseWhere(scope)),
        columns: { id: true, parentId: true },
      }),
      db.query.dossiers.findMany({
        where: activeDossierWhere(dossierBrowseWhere(scope)),
        orderBy: asc(dossiers.name),
      }),
      sumRecursiveFolderStatsByFolderIds(subfolderIds, scope),
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

    const children = subfolders
      .map((folder) => {
        const stats = statsByFolderId.get(folder.id) ?? { totalSizeKb: 0, fileCount: 0, pageCount: 0 };
        const isAssigned = isFolderSubtreeFullyAssigned(
          folder.id,
          childrenByParentId,
          dossiersByFolderId,
          dossierIdsWithAssignments,
          descendantCache,
        );
        const directDossier = directDossierByFolderId.get(folder.id);

        if (!directDossier) {
          return { ...folder, ...stats, isAssigned };
        }

        // Hồ sơ đã lưu kho không còn hiện trên cây số hóa / quản lý dữ liệu
        if (directDossier.status === DossierStatus.ARCHIVED) {
          return null;
        }

        return {
          ...folder,
          dossierId: directDossier.id,
          status: directDossier.status,
          isAssigned,
          ...stats,
        };
      })
      .filter((child): child is NonNullable<typeof child> => child != null);

    return {
      nodeType: FolderBrowseNodeType.FOLDER,
      parentId: folderId,
      projectCode: responseProjectCode,
      totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
      fileCount: children.reduce((sum, child) => sum + child.fileCount, 0),
      pageCount: children.reduce((sum, child) => sum + child.pageCount, 0),
      children,
    };
  }

  const folderDossiers = await db.query.dossiers.findMany({
    where: activeDossierWhere(
      eq(dossiers.folderId, folderId),
      dossierBrowseWhere(scope),
      ne(dossiers.status, DossierStatus.ARCHIVED),
    ),
    orderBy: asc(dossiers.name),
  });

  const dossierIds = folderDossiers.map((d) => d.id);
  const [statsByDossierId, dossierIdsWithAssignments] = await Promise.all([
    sumDossierStatsByDossierIds(dossierIds),
    loadDossierIdsWithAssignments(dossierIds),
  ]);

  const children = folderDossiers.map((d) => {
    const stats = statsByDossierId.get(d.id) ?? { totalSizeKb: 0, fileCount: 0, pageCount: 0 };
    return {
      id: d.id,
      folderId: d.folderId,
      folderPath: d.folderPath,
      name: d.name,
      entityType: d.entityType,
      status: d.status,
      isAssigned: isDossierAssigned(d, dossierIdsWithAssignments),
      ...stats,
    };
  });

  return {
    nodeType: FolderBrowseNodeType.DOSSIER,
    parentId: folderId,
    projectCode: responseProjectCode,
    totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
    fileCount: children.reduce((sum, child) => sum + child.fileCount, 0),
    pageCount: children.reduce((sum, child) => sum + child.pageCount, 0),
    children,
  };
}

async function listDossierFiles(
  dossierId: string,
  options?: {
    actorId?: string;
    status?: "draft";
    accessHeaders?: import("../security-level/security-enforcement.ts").SecurityAccessHeaders;
  },
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

  // Hồ sơ đã lưu kho: bắt buộc qua app-gate trước khi cấp URL
  const isArchived = dossier.status === "ARCHIVED";
  const { ACCESS_TTL_SEC } =
    await import("../security-level/security-access-token.ts");
  const { assertSecurityResourceAccess, SecurityRequestCache } =
    await import("../security-level/security-enforcement.ts");
  const securityCache = new SecurityRequestCache();

  if (isArchived && options?.actorId) {
    securityCache.seedDossier({
      id: dossier.id,
      securityLevelId: dossier.securityLevelId,
      accessPasswordEnabled: dossier.accessPasswordEnabled,
      accessPasswordHash: dossier.accessPasswordHash ?? null,
      passwordVersion: dossier.passwordVersion ?? 1,
    });
    await assertSecurityResourceAccess({
      userId: options.actorId,
      resourceSecurityLevelId: dossier.securityLevelId,
      permissionDefKey: "view",
      dossierId: dossier.id,
      levelToken: options.accessHeaders?.levelToken,
      levelTokens: options.accessHeaders?.levelTokens,
      dossierToken: options.accessHeaders?.dossierToken,
      dossierTokens: options.accessHeaders?.dossierTokens,
      fileTokens: options.accessHeaders?.fileTokens,
      cache: securityCache,
    });
  }

  const files = await db.query.dossierFiles.findMany({
    where: eq(dossierFiles.dossierId, dossierId),
    orderBy: asc(dossierFiles.fileName),
  });

  if (isArchived && options?.actorId) {
    for (const file of files) {
      securityCache.seedFile({
        id: file.id,
        dossierId: dossier.id,
        securityLevelId: file.securityLevelId,
        accessPasswordEnabled: file.accessPasswordEnabled,
        accessPasswordHash: file.accessPasswordHash ?? null,
        passwordVersion: file.passwordVersion ?? 1,
        fileName: file.fileName,
        filePath: file.filePath,
      });
    }
    await securityCache.preloadRules([
      dossier.securityLevelId,
      ...files.map((file) => file.securityLevelId ?? dossier.securityLevelId),
    ]);
    await securityCache.loadLevelCredentials([
      dossier.securityLevelId,
      ...files.map((file) => file.securityLevelId),
    ]);
  }

  const children = await Promise.all(
    files.map(async (file) => {
      if (isArchived && options?.actorId) {
        const effectiveLevelId =
          file.securityLevelId ?? dossier.securityLevelId;
        try {
          await assertSecurityResourceAccess({
            userId: options.actorId,
            resourceSecurityLevelId: effectiveLevelId,
            permissionDefKey: "view",
            dossierId: dossier.id,
            fileId: file.id,
            levelToken: options.accessHeaders?.levelToken,
            levelTokens: options.accessHeaders?.levelTokens,
            dossierToken: options.accessHeaders?.dossierToken,
            dossierTokens: options.accessHeaders?.dossierTokens,
            fileTokens: options.accessHeaders?.fileTokens,
            cache: securityCache,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith("PASSWORD_REQUIRED:")
          ) {
            return {
              ...file,
              accessLocked: true,
              fileUrl: "",
              searchablePdfPath: null,
              searchablePdfUrl: null,
              signedFileUrl: null,
            };
          }
          throw error;
        }
      }

      const searchablePdfPath = toSearchablePdfKey(file.filePath);
      const [fileUrl, searchablePdfUrl, signedFileUrl] = await Promise.all([
        buildLinkGet(file.filePath, {
          expirySeconds: isArchived ? ACCESS_TTL_SEC : undefined,
        }),
        searchablePdfPath
          ? buildLinkGet(searchablePdfPath, {
              expirySeconds: isArchived ? ACCESS_TTL_SEC : undefined,
            })
          : Promise.resolve(null),
        file.signedFilePath
          ? buildLinkGet(file.signedFilePath, {
              expirySeconds: isArchived ? ACCESS_TTL_SEC : undefined,
            })
          : Promise.resolve(null),
      ]);
      return {
        ...file,
        accessLocked: false,
        fileUrl: fileUrl ?? "",
        searchablePdfPath,
        searchablePdfUrl: searchablePdfUrl ?? null,
        signedFileUrl: signedFileUrl ?? null,
      };
    }),
  );

  const rawMetadataKey = loadDraft
    ? resolveDossierDraftKey({
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
        assignmentId: assignment?.id,
      })
    : await resolveReadableMetadataStorageKey(
      {
        dossierName: dossier.name,
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
        folderPath: dossier.folderPath,
      },
      { listSiblingJsonKeys: listJsonObjectsUnderPrefix },
    );
  const metadataKeyJson =
    rawMetadataKey && !rawMetadataKey.endsWith(".json")
      ? `${rawMetadataKey}.json`
      : rawMetadataKey;
  const currentMetadataUrl = isArchived
    ? null
    : await buildLinkGet(metadataKeyJson);

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

async function assertFolderSubtreeHasNoAssignments(tx: DbTx, folderId: string) {
  const descendantFolderIds = await collectDescendantFolderIds(tx, folderId);
  const dossierRows = await tx
    .select({
      id: dossiers.id,
      assignedGroupId: dossiers.assignedGroupId,
    })
    .from(dossiers)
    .where(activeDossierWhere(inArray(dossiers.folderId, descendantFolderIds)));

  const dossierIds = dossierRows.map((row) => row.id);
  const dossierIdsWithAssignments = await loadDossierIdsWithAssignmentsInTx(
    tx,
    dossierIds,
  );

  const hasAssignment = dossierRows.some((dossier) =>
    isDossierAssigned(dossier, dossierIdsWithAssignments),
  );

  if (hasAssignment) {
    throw httpError.conflict("Không thể đổi dự án vì thư mục đã có phân công");
  }
}

export const FolderService = {
  ...crud,

  async create(input: Static<typeof createFolderSchema>) {
    await ProjectService.assertProjectExists(input.projectCode);
    return await crud.create(input);
  },

  async update(id: string, input: Static<typeof updateFolderSchema>) {
    const { projectCode, ...otherFields } = input;

    if (projectCode !== undefined) {
      await assignFolderProjectCode(id, projectCode);
    }

    if (Object.keys(otherFields).length === 0) {
      const folder = await db.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, id)),
        with: { parent: true, children: true, dossiers: true },
      });
      if (!folder) {
        throw httpError.notFound("Folder not found");
      }
      return folder;
    }

    return await crud.update(id, otherFields);
  },

  async assignProject(
    folderId: string,
    input: Static<typeof assignFolderProjectBodySchema>,
  ) {
    const projectCode = input.projectCode?.trim() ?? null;
    if (projectCode !== null) {
      await ProjectService.assertProjectExists(projectCode);
    }

    return await db.transaction(async (tx) => {
      const folder = await tx.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
      });

      if (!folder) {
        throw httpError.notFound("Folder not found");
      }

      if (isUnscopedRawRoot(folder)) {
        throw httpError.badRequest("Không thể gán dự án cho thư mục gốc raw/");
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
  searchTree,
};
