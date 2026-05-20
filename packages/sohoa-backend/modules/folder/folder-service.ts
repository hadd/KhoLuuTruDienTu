import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
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
        return {
            nodeType: FolderBrowseNodeType.FOLDER,
            parentId: folderId,
            children: subfolders,
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

async function listDossierFiles(dossierId: string) {
    const dossier = await db.query.dossiers.findFirst({
        where: eq(dossiers.id, dossierId),
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    const children = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        orderBy: asc(dossierFiles.fileName),
    });

    return {
        nodeType: FolderBrowseNodeType.FILE,
        dossierId,
        children,
    };
}

export const FolderService = {
    ...crud,
    listAllParents,
    listAllFirstSubfolders,
    listDossierFiles,
};
