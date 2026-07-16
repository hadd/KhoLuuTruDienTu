import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { isActiveDossier } from "../dossier/active-query-filters.ts";
import {
    normalizeStorageKey,
    storageBasename,
} from "../dossier/dossier-path-utils.ts";
import { storageObjectExists } from "./archive-warehouse-storage.ts";

const MAX_UNIQUE_PATH_ATTEMPTS = 10;

export type UniqueWarehouseDestinationPath = {
    destPath: string;
    destFileName: string;
    renamed: boolean;
};

async function isFilePathTakenInDb(
    filePath: string,
    excludeFileId?: string,
): Promise<boolean> {
    const normalizedPath = normalizeStorageKey(filePath);
    const existing = await db.query.dossierFiles.findFirst({
        where: eq(dossierFiles.filePath, normalizedPath),
        with: {
            dossier: {
                columns: { deletedAt: true },
            },
        },
    });

    if (!existing || !isActiveDossier(existing.dossier)) {
        return false;
    }

    if (excludeFileId && existing.id === excludeFileId) {
        return false;
    }

    return true;
}

async function isDestinationPathTaken(
    filePath: string,
    excludeFileId?: string,
): Promise<boolean> {
    const dbTaken = await isFilePathTakenInDb(filePath, excludeFileId);
    if (dbTaken) return true;
    return await storageObjectExists(filePath);
}

export async function resolveUniqueWarehouseDestinationPath(input: {
    folderPath: string;
    fileName: string;
    excludeFileId?: string;
}): Promise<UniqueWarehouseDestinationPath> {
    const folder = normalizeStorageKey(input.folderPath).replace(/\/+$/, "");
    const baseName = storageBasename(input.fileName) || "document.pdf";

    let candidateName = baseName;
    let candidatePath = `${folder}/${candidateName}`;
    let renamed = false;

    for (let attempt = 0; attempt < MAX_UNIQUE_PATH_ATTEMPTS; attempt++) {
        const taken = await isDestinationPathTaken(candidatePath, input.excludeFileId);
        if (!taken) {
            return {
                destPath: candidatePath,
                destFileName: candidateName,
                renamed,
            };
        }

        renamed = true;
        candidateName = `${crypto.randomUUID()}-${baseName}`;
        candidatePath = `${folder}/${candidateName}`;
    }

    throw httpError.badRequest(
        "Không thể tạo đường dẫn đích duy nhất cho file sau nhiều lần thử",
    );
}
