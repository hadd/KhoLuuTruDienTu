import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { activeDossierWhere, activeFolderWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { AssignmentStatus } from "../../db/schemas/workflow-constants.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import { FolderBrowseNodeType } from "./folder-browse-constants.ts";
import {
    createFolderSchema,
    folderEntitySchema,
    updateFolderSchema,
} from "./types.ts";

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

async function loadDirectFileSizeKbByFolderId() {
    const rows = await db
        .select({
            folderId: dossiers.folderId,
            totalSizeKb: sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
        })
        .from(dossiers)
        .innerJoin(dossierFiles, eq(dossierFiles.dossierId, dossiers.id))
        .where(activeDossierWhere())
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

function getRecursiveFolderSizeKb(folderId: string, index: FolderSizeIndex): number {
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

async function sumRecursiveFileSizeKbByFolderIds(rootFolderIds: string[]) {
    if (rootFolderIds.length === 0) {
        return new Map<string, number>();
    }

    const [allFolders, directSizeByFolderId] = await Promise.all([
        db.query.folders.findMany({
            where: activeFolderWhere(),
            columns: { id: true, parentId: true },
        }),
        loadDirectFileSizeKbByFolderId(),
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
            totalSizeKb: sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
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
    return dossier.assignedGroupId != null
        || dossierIdsWithAssignments.has(dossier.id);
}

async function loadDossierIdsWithAssignments(dossierIds: string[]) {
    if (dossierIds.length === 0) {
        return new Set<string>();
    }

    const rows = await db
        .selectDistinct({ dossierId: dossierAssignments.dossierId })
        .from(dossierAssignments)
        .where(and(
            inArray(dossierAssignments.dossierId, dossierIds),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
        ));

    return new Set(rows.map((row) => row.dossierId));
}

async function listAllParents() {
    const children = await db.query.folders.findMany({
        where: activeFolderWhere(isNull(folders.parentId)),
        orderBy: asc(folders.folderName),
    });

    return { nodeType: FolderBrowseNodeType.FOLDER, children };
}

async function listAllFirstSubfolders(folderId: string) {
    const folder = await db.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
    });

    if (!folder) {
        throw httpError.notFound("Folder not found");
    }

    const subfolders = await db.query.folders.findMany({
        where: activeFolderWhere(eq(folders.parentId, folderId)),
        orderBy: asc(folders.folderName),
    });

    if (subfolders.length > 0) {
        const subfolderIds = subfolders.map((folder) => folder.id);
        const [matchedDossiers, sizeKbByFolderId] = await Promise.all([
            db.query.dossiers.findMany({
                where: activeDossierWhere(inArray(dossiers.folderId, subfolderIds)),
                orderBy: asc(dossiers.name),
            }),
            sumRecursiveFileSizeKbByFolderIds(subfolderIds),
        ]);

        const dossierByFolderId = new Map<string, (typeof matchedDossiers)[number]>();
        for (const dossier of matchedDossiers) {
            if (!dossierByFolderId.has(dossier.folderId)) {
                dossierByFolderId.set(dossier.folderId, dossier);
            }
        }

        const dossierIdsWithAssignments = await loadDossierIdsWithAssignments(
            matchedDossiers.map((dossier) => dossier.id),
        );

        const children = subfolders.map((folder) => {
            const totalSizeKb = sizeKbByFolderId.get(folder.id) ?? 0;
            const dossier = dossierByFolderId.get(folder.id);
            if (!dossier) {
                return { ...folder, totalSizeKb };
            }

            return {
                ...folder,
                dossierId: dossier.id,
                status: dossier.status,
                isAssigned: isDossierAssigned(dossier, dossierIdsWithAssignments),
                totalSizeKb,
            };
        });

        return {
            nodeType: FolderBrowseNodeType.FOLDER,
            parentId: folderId,
            totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
            children,
        };
    }

    const folderDossiers = await db.query.dossiers.findMany({
        where: activeDossierWhere(eq(dossiers.folderId, folderId)),
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
        totalSizeKb: children.reduce((sum, child) => sum + child.totalSizeKb, 0),
        children,
    };
}

type FolderTreeFileNode = {
    nodeType: typeof FolderBrowseNodeType.FILE;
    id: string;
    dossierId: string;
    fileName: string;
    filePath: string;
    fileSizeKb: number | null;
    createdAt: Date;
};

type FolderTreeDossierNode = {
    nodeType: typeof FolderBrowseNodeType.DOSSIER;
    id: string;
    folderId: string;
    folderPath: string;
    name: string;
    entityType: string;
    status: string;
    files: FolderTreeFileNode[];
};

type FolderTreeFolderNode = {
    nodeType: typeof FolderBrowseNodeType.FOLDER;
    id: string;
    parentId: string | null;
    folderPath: string;
    folderName: string;
    createdAt: Date;
    updatedAt: Date;
    children: Array<FolderTreeFolderNode | FolderTreeDossierNode>;
};

function sortFolderTreeChildren(
    children: Array<FolderTreeFolderNode | FolderTreeDossierNode>,
): Array<FolderTreeFolderNode | FolderTreeDossierNode> {
    return [...children].sort((a, b) => {
        if (a.nodeType !== b.nodeType) {
            return a.nodeType === FolderBrowseNodeType.FOLDER ? -1 : 1;
        }
        const labelA = a.nodeType === FolderBrowseNodeType.FOLDER ? a.folderName : a.name;
        const labelB = b.nodeType === FolderBrowseNodeType.FOLDER ? b.folderName : b.name;
        return labelA.localeCompare(labelB);
    });
}

function sortFolderTree(nodes: FolderTreeFolderNode[]) {
    for (const node of nodes) {
        node.children = sortFolderTreeChildren(node.children);
        const subfolders = node.children.filter(
            (child): child is FolderTreeFolderNode =>
                child.nodeType === FolderBrowseNodeType.FOLDER,
        );
        sortFolderTree(subfolders);
    }
}

async function getFullFolderTree() {
    const [allFolders, allDossiers, allFiles] = await Promise.all([
        db.query.folders.findMany({
            where: activeFolderWhere(),
            orderBy: asc(folders.folderPath),
        }),
        db.query.dossiers.findMany({
            where: activeDossierWhere(),
            orderBy: asc(dossiers.name),
        }),
        db.query.dossierFiles.findMany({
            orderBy: asc(dossierFiles.fileName),
        }),
    ]);

    const filesByDossierId = new Map<string, FolderTreeFileNode[]>();
    for (const file of allFiles) {
        const list = filesByDossierId.get(file.dossierId) ?? [];
        list.push({
            nodeType: FolderBrowseNodeType.FILE,
            id: file.id,
            dossierId: file.dossierId,
            fileName: file.fileName,
            filePath: file.filePath,
            fileSizeKb: file.fileSizeKb,
            createdAt: file.createdAt,
        });
        filesByDossierId.set(file.dossierId, list);
    }

    const dossiersByFolderId = new Map<string, FolderTreeDossierNode[]>();
    for (const dossier of allDossiers) {
        const list = dossiersByFolderId.get(dossier.folderId) ?? [];
        list.push({
            nodeType: FolderBrowseNodeType.DOSSIER,
            id: dossier.id,
            folderId: dossier.folderId,
            folderPath: dossier.folderPath,
            name: dossier.name,
            entityType: dossier.entityType,
            status: dossier.status,
            files: filesByDossierId.get(dossier.id) ?? [],
        });
        dossiersByFolderId.set(dossier.folderId, list);
    }

    const folderNodes = new Map<string, FolderTreeFolderNode>();
    for (const folder of allFolders) {
        folderNodes.set(folder.id, {
            nodeType: FolderBrowseNodeType.FOLDER,
            id: folder.id,
            parentId: folder.parentId,
            folderPath: folder.folderPath,
            folderName: folder.folderName,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
            children: [],
        });
    }

    const roots: FolderTreeFolderNode[] = [];

    for (const folder of allFolders) {
        const node = folderNodes.get(folder.id);
        if (!node) {
            continue;
        }

        const dossierChildren = dossiersByFolderId.get(folder.id) ?? [];
        node.children.push(...dossierChildren);

        if (folder.parentId) {
            const parent = folderNodes.get(folder.parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        } else {
            roots.push(node);
        }
    }

    sortFolderTree(roots);

    return {
        nodeType: FolderBrowseNodeType.FOLDER,
        children: sortFolderTreeChildren(roots),
        totalFolders: allFolders.length,
        totalDossiers: allDossiers.length,
        totalFiles: allFiles.length,
    };
}

async function listDossierFiles(dossierId: string) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        orderBy: asc(dossierFiles.fileName),
    });

    const children = await Promise.all(
        files.map(async (file) => ({
            ...file,
            fileUrl: (await buildLinkGet(file.filePath)) ?? "",
        })),
    );

    const rawMetadataKey = dossier.currentMetadataKey;
    const metadataKeyJson = rawMetadataKey && !rawMetadataKey.endsWith(".json")
        ? `${rawMetadataKey}.json`
        : rawMetadataKey;
    const currentMetadataUrl = await buildLinkGet(metadataKeyJson);

    return {
        nodeType: FolderBrowseNodeType.FILE,
        dossierId,
        currentMetadataUrl,
        children,
    };
}

export const FolderService = {
    ...crud,
    listAllParents,
    listAllFirstSubfolders,
    listDossierFiles,
    getFullFolderTree,
};
