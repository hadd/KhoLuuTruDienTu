import { and, isNull, type SQL } from "drizzle-orm";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";

type SqlCondition = SQL | undefined;

function combineConditions(...parts: SqlCondition[]): SQL {
    const conditions = parts.filter((part): part is SQL => part !== undefined);
    if (conditions.length === 0) {
        throw new Error("At least one SQL condition is required");
    }
    return conditions.length === 1 ? conditions[0] : and(...conditions)!;
}

/** WHERE fragment: dossier is not soft-deleted. */
export function activeDossierWhere(...conditions: SqlCondition[]): SQL {
    return combineConditions(...conditions, isNull(dossiers.deletedAt));
}

/** WHERE fragment: folder is not soft-deleted. */
export function activeFolderWhere(...conditions: SqlCondition[]): SQL {
    return combineConditions(...conditions, isNull(folders.deletedAt));
}

export function isActiveDossier(
    dossier: { deletedAt: Date | null } | null | undefined,
): dossier is { deletedAt: null } {
    return !!dossier && dossier.deletedAt === null;
}

export function isActiveFolder(
    folder: { deletedAt: Date | null } | null | undefined,
): folder is { deletedAt: null } {
    return !!folder && folder.deletedAt === null;
}
