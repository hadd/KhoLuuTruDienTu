import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { isProtectedArchivalKey } from "../dossier/dossier-delete-utils.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import { resolveUniqueWarehouseDestinationPath } from "./archive-warehouse-path.ts";
import {
    copyStorageObject,
    deleteStorageObjectQuiet,
    statWarehouseStorageObject,
} from "./archive-warehouse-storage.ts";

export type WarehouseFileMoveInput = {
    file: {
        id: string;
        fileName: string;
        filePath: string;
        fileSizeKb: number | null;
    };
    source: { id: string };
    target: { id: string; folderPath: string };
};

export type WarehouseFileMoveResult = {
    destPath: string;
    destFileName: string;
    renamed: boolean;
    fileSizeKb: number;
};

type UpdateFileRecordFn = (input: {
    fileId: string;
    targetDossierId: string;
    destPath: string;
    destFileName: string;
    fileSizeKb: number;
}) => Promise<void>;

let updateFileRecordOverride: UpdateFileRecordFn | null = null;

export function setUpdateFileRecordOverrideForTests(fn: UpdateFileRecordFn | null) {
    updateFileRecordOverride = fn;
}

async function updateMovedFileRecord(input: {
    fileId: string;
    targetDossierId: string;
    destPath: string;
    destFileName: string;
    fileSizeKb: number;
}): Promise<void> {
    if (updateFileRecordOverride) {
        await updateFileRecordOverride(input);
        return;
    }

    await db
        .update(dossierFiles)
        .set({
            dossierId: input.targetDossierId,
            filePath: input.destPath,
            fileName: input.destFileName,
            fileSizeKb: input.fileSizeKb,
        })
        .where(eq(dossierFiles.id, input.fileId));
}

export async function executeWarehouseFileMove(
    input: WarehouseFileMoveInput,
): Promise<WarehouseFileMoveResult> {
    const { destPath, destFileName, renamed } = await resolveUniqueWarehouseDestinationPath({
        folderPath: input.target.folderPath,
        fileName: input.file.fileName,
        excludeFileId: input.file.id,
    });

    await copyStorageObject(input.file.filePath, destPath);

    let dbUpdated = false;
    try {
        const { size } = await statWarehouseStorageObject(destPath);
        const fileSizeKb = Math.max(1, Math.ceil(size / 1024));

        await updateMovedFileRecord({
            fileId: input.file.id,
            targetDossierId: input.target.id,
            destPath,
            destFileName,
            fileSizeKb,
        });
        dbUpdated = true;

        if (
            normalizeStorageKey(input.file.filePath) !== destPath &&
            !isProtectedArchivalKey(input.file.filePath)
        ) {
            await deleteStorageObjectQuiet(input.file.filePath);
        }

        return { destPath, destFileName, renamed, fileSizeKb };
    } catch (error) {
        if (!dbUpdated) {
            await deleteStorageObjectQuiet(destPath);
        }
        throw error;
    }
}
