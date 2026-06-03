import { httpError } from "@shared/common-lib";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import type { Dossier } from "../../db/schemas/dossier.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    expandKeysWithDocJsonMirrors,
    normalizeStorageKey,
    toDocJsonDataLakePrefix,
} from "./dossier-path-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function isPermanentDeleteFlag(value: string | boolean | undefined): boolean {
    if (value === true) return true;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return false;
}

export function sortFoldersDeepestFirst<T extends { folderPath: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => b.folderPath.length - a.folderPath.length);
}

type DossierFileRow = { filePath: string };
type AssignmentRow = { metadataKey: string | null };

function addKey(keys: Set<string>, raw: string | null | undefined) {
    if (!raw) return;
    keys.add(normalizeStorageKey(raw));
}

export function collectDossierStorageKeys(
    dossier: Pick<Dossier, "ocrMetadataKey" | "currentMetadataKey" | "folderPath">,
    files: DossierFileRow[],
    assignments: AssignmentRow[],
): Set<string> {
    const keys = new Set<string>();
    addKey(keys, dossier.ocrMetadataKey);
    addKey(keys, dossier.currentMetadataKey);
    for (const file of files) {
        addKey(keys, file.filePath);
    }
    for (const assignment of assignments) {
        addKey(keys, assignment.metadataKey);
    }
    expandKeysWithDocJsonMirrors(keys);
    return keys;
}

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

async function listKeysUnderPrefix(bucket: string, folderPath: string): Promise<string[]> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const prefix = normalizeStorageKey(folderPath).replace(/\/?$/, "/");
    const result = await s3.listFiles({
        bucket,
        prefix,
        maxKeys: 10_000,
    });

    return result.files
        .map((file) => file.objectName)
        .filter((name): name is string => !!name)
        .map(normalizeStorageKey);
}

type PurgeFn = (explicitKeys: Set<string>, folderPath: string) => Promise<number>;

let purgeOverride: PurgeFn | null = null;

export function setPurgeDossierFromMinIOOverrideForTests(fn: PurgeFn | null) {
    purgeOverride = fn;
}

export async function purgeDossierFromMinIO(
    explicitKeys: Set<string>,
    folderPath: string,
): Promise<number> {
    if (purgeOverride) {
        return await purgeOverride(explicitKeys, folderPath);
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const prefixesToScan = [
        normalizeStorageKey(folderPath).replace(/\/?$/, "/"),
    ];
    const docJsonPrefix = toDocJsonDataLakePrefix(folderPath);
    if (docJsonPrefix) {
        prefixesToScan.push(docJsonPrefix);
    }

    const prefixKeys: string[] = [];
    for (const prefix of prefixesToScan) {
        prefixKeys.push(...await listKeysUnderPrefix(bucket, prefix));
    }

    const allKeys = new Set([...explicitKeys, ...prefixKeys]);

    let deletedCount = 0;
    const errors: string[] = [];

    for (const objectName of allKeys) {
        try {
            await s3.deleteFile({ bucket, objectName });
            deletedCount++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${objectName}: ${msg}`);
        }
    }

    if (errors.length > 0) {
        throw httpError.serviceUnavailable(
            `Failed to delete ${errors.length} object(s) from storage: ${errors.slice(0, 3).join("; ")}`,
        );
    }

    return deletedCount;
}

async function countActiveDossiersOnFolder(tx: DbTx, folderId: string): Promise<number> {
    const [usage] = await tx
        .select({ value: count() })
        .from(dossiers)
        .where(and(eq(dossiers.folderId, folderId), isNull(dossiers.deletedAt)));
    return usage?.value ?? 0;
}

async function countActiveChildFolders(tx: DbTx, folderId: string): Promise<number> {
    const [childUsage] = await tx
        .select({ value: count() })
        .from(folders)
        .where(and(eq(folders.parentId, folderId), isNull(folders.deletedAt)));
    return childUsage?.value ?? 0;
}

/** Soft-delete leaf folder and empty active ancestors when no active dossier references them. */
export async function softDeleteOrphanFoldersAfterDossier(
    tx: DbTx,
    folderId: string,
    deletedAt: Date,
): Promise<string[]> {
    const deletedFolderIds: string[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
        if (await countActiveDossiersOnFolder(tx, currentId) > 0) {
            break;
        }
        if (await countActiveChildFolders(tx, currentId) > 0) {
            break;
        }

        const folder = await tx.query.folders.findFirst({
            where: and(eq(folders.id, currentId), isNull(folders.deletedAt)),
            columns: { id: true, parentId: true },
        });

        if (!folder) {
            break;
        }

        await tx
            .update(folders)
            .set({ deletedAt, updatedAt: deletedAt })
            .where(eq(folders.id, folder.id));

        deletedFolderIds.push(folder.id);
        currentId = folder.parentId;
    }

    return deletedFolderIds;
}

/** Hard-delete leaf folder and empty ancestors when no dossier row references them. */
export async function deleteOrphanFoldersAfterDossier(
    tx: DbTx,
    folderId: string,
): Promise<string[]> {
    const deletedFolderIds: string[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
        const [usage] = await tx
            .select({ value: count() })
            .from(dossiers)
            .where(eq(dossiers.folderId, currentId));

        if ((usage?.value ?? 0) > 0) {
            break;
        }
        if (await countActiveChildFolders(tx, currentId) > 0) {
            break;
        }

        const folder = await tx.query.folders.findFirst({
            where: eq(folders.id, currentId),
            columns: { id: true, parentId: true },
        });

        if (!folder) {
            break;
        }

        await tx.delete(folders).where(eq(folders.id, folder.id));
        deletedFolderIds.push(folder.id);
        currentId = folder.parentId;
    }

    return deletedFolderIds;
}

export async function softDeleteFoldersByIds(
    tx: DbTx,
    folderIds: string[],
    deletedAt: Date,
): Promise<string[]> {
    if (folderIds.length === 0) return [];

    const rows = await tx
        .update(folders)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(and(inArray(folders.id, folderIds), isNull(folders.deletedAt)))
        .returning({ id: folders.id });

    return rows.map((row) => row.id);
}

export async function hardDeleteFoldersByIds(tx: DbTx, folderIds: string[]): Promise<string[]> {
    if (folderIds.length === 0) return [];

    const rows = await tx
        .delete(folders)
        .where(inArray(folders.id, folderIds))
        .returning({ id: folders.id });

    return rows.map((row) => row.id);
}
