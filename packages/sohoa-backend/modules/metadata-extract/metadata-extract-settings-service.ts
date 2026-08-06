import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    MetadataExtractMode,
    METADATA_EXTRACT_MODE_VALUES,
    metadataExtractSettings,
    type MetadataExtractMode as MetadataExtractModeType,
} from "../../db/schemas/metadata-extract-settings.ts";

let cachedMode: MetadataExtractModeType | null = null;

function parseMode(raw: string): MetadataExtractModeType {
    if ((METADATA_EXTRACT_MODE_VALUES as string[]).includes(raw)) {
        return raw as MetadataExtractModeType;
    }
    return MetadataExtractMode.OLD;
}

async function ensureSettingsRow() {
    const existing = await db.query.metadataExtractSettings.findFirst();
    if (existing) return existing;

    const [created] = await db
        .insert(metadataExtractSettings)
        .values({ mode: MetadataExtractMode.OLD })
        .returning();
    return created;
}

export function invalidateMetadataExtractModeCache() {
    cachedMode = null;
}

export async function getMetadataExtractMode(): Promise<MetadataExtractModeType> {
    if (cachedMode) return cachedMode;
    const row = await ensureSettingsRow();
    cachedMode = parseMode(row.mode);
    return cachedMode;
}

export async function getMetadataExtractSettings() {
    const row = await ensureSettingsRow();
    return {
        id: row.id,
        mode: parseMode(row.mode),
        updatedById: row.updatedById,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
    };
}

export async function setMetadataExtractMode(
    mode: MetadataExtractModeType,
    actorId: string,
) {
    if (!(METADATA_EXTRACT_MODE_VALUES as string[]).includes(mode)) {
        throw httpError.badRequest(`Invalid metadata extract mode: ${mode}`);
    }

    const row = await ensureSettingsRow();
    const [updated] = await db
        .update(metadataExtractSettings)
        .set({
            mode,
            updatedById: actorId,
            updatedAt: new Date(),
        })
        .where(eq(metadataExtractSettings.id, row.id))
        .returning();

    cachedMode = parseMode(updated.mode);
    return {
        id: updated.id,
        mode: cachedMode,
        updatedById: updated.updatedById,
        updatedAt: updated.updatedAt,
        createdAt: updated.createdAt,
    };
}
