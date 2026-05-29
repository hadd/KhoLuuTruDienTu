import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
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

async function listAllParents() {
    const children = await db.query.folders.findMany({
        where: isNull(folders.parentId),
        orderBy: asc(folders.folderName),
    });

    return { nodeType: FolderBrowseNodeType.FOLDER, children };
}

async function listAllFirstSubfolders(folderId: string) {
    const folder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId),
    });

    if (!folder) {
        throw httpError.notFound("Folder not found");
    }

    const subfolders = await db.query.folders.findMany({
        where: eq(folders.parentId, folderId),
        orderBy: asc(folders.folderName),
    });

    if (subfolders.length > 0) {
        const subfolderIds = subfolders.map((folder) => folder.id);
        const matchedDossiers = await db.query.dossiers.findMany({
            where: inArray(dossiers.folderId, subfolderIds),
            orderBy: asc(dossiers.name),
        });

        const dossierByFolderId = new Map<string, (typeof matchedDossiers)[number]>();
        for (const dossier of matchedDossiers) {
            if (!dossierByFolderId.has(dossier.folderId)) {
                dossierByFolderId.set(dossier.folderId, dossier);
            }
        }

        return {
            nodeType: FolderBrowseNodeType.FOLDER,
            parentId: folderId,
            children: subfolders.map((folder) => {
                const dossier = dossierByFolderId.get(folder.id);
                if (!dossier) {
                    return folder;
                }

                return {
                    ...folder,
                    dossierId: dossier.id,
                    status: dossier.status,
                };
            }),
        };
    }

    const folderDossiers = await db.query.dossiers.findMany({
        where: eq(dossiers.folderId, folderId),
        orderBy: asc(dossiers.name),
    });

    return {
        nodeType: FolderBrowseNodeType.DOSSIER,
        parentId: folderId,
        children: folderDossiers.map((d) => ({
            id: d.id,
            folderId: d.folderId,
            folderPath: d.folderPath,
            name: d.name,
            entityType: d.entityType,
            status: d.status,
        })),
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
            orderBy: asc(folders.folderPath),
        }),
        db.query.dossiers.findMany({
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
        where: eq(dossiers.id, dossierId),
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
