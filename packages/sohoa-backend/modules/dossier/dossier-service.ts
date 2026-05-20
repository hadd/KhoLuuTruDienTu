import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, eq } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { DossierStatus, EntityType } from "../../db/schemas/workflow-constants.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    folderNameFromPath,
    normalizeStorageKey,
    splitFolderSegments,
    storageBasename,
    storageDirname,
} from "./dossier-path-utils.ts";
import {
    createDossierSchema,
    createDocumentFromStorageBodySchema,
    createUploadPointBodySchema,
    dossierEntitySchema,
    updateDossierSchema,
} from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StorageStatFn = (key: string) => Promise<{ fileSizeKb: number | null }>;

let storageStatOverride: StorageStatFn | null = null;

export function setStorageStatOverrideForTests(fn: StorageStatFn | null) {
    storageStatOverride = fn;
}

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

const crud = createCrudService({
    db,
    table: dossiers,
    searchable: ["name", "folderPath"],
    entitySchema: dossierEntitySchema,
    createSchema: createDossierSchema,
    updateSchema: updateDossierSchema,
    defaultWith: {
        folder: true,
        files: true,
    },
    metadata: {
        tags: ["Dossier"],
        descriptions: {
            list: "List dossiers with pagination, filtering and search.",
            get: "Get a dossier by ID with folder and files.",
            create: "Create a dossier record.",
            update: "Update a dossier record.",
            delete: "Delete a dossier record.",
        },
    },
});

async function findFolderByPath(tx: DbTx, folderPath: string) {
    return await tx.query.folders.findFirst({
        where: eq(folders.folderPath, folderPath),
    });
}

async function ensureFolderTree(tx: DbTx, folderPath: string): Promise<string> {
    const segments = splitFolderSegments(folderPath);
    let parentId: string | null = null;

    for (const segmentPath of segments) {
        const result: { id: string }[] = await tx
            .insert(folders)
            .values({
                parentId,
                folderPath: segmentPath,
                folderName: folderNameFromPath(segmentPath),
            })
            .onConflictDoNothing({ target: folders.folderPath })
            .returning({ id: folders.id });

        const inserted = result[0];

        if (inserted) {
            parentId = inserted.id;
            continue;
        }

        const existing = await findFolderByPath(tx, segmentPath);
        if (!existing) {
            throw httpError.internal("Failed to resolve folder after conflict");
        }
        parentId = existing.id;
    }

    if (!parentId) {
        throw httpError.internal("Failed to resolve leaf folder");
    }

    return parentId;
}

async function findOrCreateDossier(
    tx: DbTx,
    folderId: string,
    folderPath: string,
    name: string,
) {
    const [inserted] = await tx
        .insert(dossiers)
        .values({
            folderId,
            folderPath,
            name,
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.NEW,
        })
        .onConflictDoNothing({ target: [dossiers.folderPath, dossiers.name] })
        .returning();

    if (inserted) {
        return inserted;
    }

    const existing = await tx.query.dossiers.findFirst({
        where: and(eq(dossiers.folderPath, folderPath), eq(dossiers.name, name)),
    });

    if (!existing) {
        throw httpError.internal("Failed to resolve dossier after conflict");
    }

    return existing;
}

async function insertDossierFile(
    tx: DbTx,
    dossierId: string,
    fileName: string,
    filePath: string,
    fileSizeKb: number | null,
) {
    const [inserted] = await tx
        .insert(dossierFiles)
        .values({
            dossierId,
            fileName,
            filePath,
            fileSizeKb,
        })
        .onConflictDoNothing({ target: dossierFiles.filePath })
        .returning();

    if (inserted) {
        return { file: inserted, created: true };
    }

    const existing = await tx.query.dossierFiles.findFirst({
        where: eq(dossierFiles.filePath, filePath),
    });

    if (!existing) {
        throw httpError.internal("Failed to resolve dossier file after conflict");
    }

    return { file: existing, created: false };
}

async function statStorageObject(key: string) {
    if (storageStatOverride) {
        return await storageStatOverride(key);
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();

    try {
        const stat = await s3.getMinIOClient().statObject(bucket, key);
        const fileSizeKb = stat.size > 0 ? Math.ceil(stat.size / 1024) : null;
        return { fileSizeKb };
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            throw httpError.notFound("File not found on storage");
        }
        throw error;
    }
}

export const DossierService = {
    ...crud,

    async createUploadPoint(input: Static<typeof createUploadPointBodySchema>) {
        const s3 = await getS3Client();
        if (!s3) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }

        const bucket = resolveS3Bucket();
        const prefix = input.prefix ?? `uploads/${crypto.randomUUID()}/`;
        const result = await s3.generatePresignedPostPolicy({
            bucket,
            prefix,
            expiry: input.expiry,
            maxFileSize: input.maxFileSize,
            contentTypePrefix: input.contentTypePrefix,
        });

        return { ...result, bucket };
    },

    async checkFilePathExists(filePath: string) {
        const normalizedPath = normalizeStorageKey(filePath);
        const existing = await db.query.dossierFiles.findFirst({
            where: eq(dossierFiles.filePath, normalizedPath),
        });

        if (!existing) {
            return { exists: false as const };
        }

        return {
            exists: true as const,
            fileId: existing.id,
        };
    },

    async createDocumentFromStorage(input: Static<typeof createDocumentFromStorageBodySchema>) {
        const key = normalizeStorageKey(input.key);
        const { fileSizeKb } = await statStorageObject(key);

        const filePath = key;
        const folderPath = storageDirname(filePath);
        if (!folderPath) {
            throw httpError.badRequest("File key must include a folder path");
        }

        const folderName = folderNameFromPath(folderPath);
        const fileName = storageBasename(filePath);

        return await db.transaction(async (tx) => {
            const folderId = await ensureFolderTree(tx, folderPath);
            const dossier = await findOrCreateDossier(tx, folderId, folderPath, folderName);
            const { file, created } = await insertDossierFile(
                tx,
                dossier.id,
                fileName,
                filePath,
                fileSizeKb,
            );

            return { dossier, file, created };
        });
    },
};
