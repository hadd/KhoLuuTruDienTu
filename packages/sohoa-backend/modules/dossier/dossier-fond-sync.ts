import { eq } from "drizzle-orm";
import {
    findHoSoFondFieldValue,
    parseDossierMetadata,
} from "../../libs/metadata-normalize.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import { activeDossierWhere } from "./active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function syncDossierFondIdFromMetadata(
    dossierId: string,
    metadata: unknown,
    tx?: DbTx,
): Promise<void> {
    if (!isDossierMetadata(metadata)) {
        return;
    }

    const parsed = parseDossierMetadata(metadata);
    // Field FOND trong metadata chứa tên phông (fond_name), không phải fond_id.
    // Cần lookup bảng fonds để lấy đúng id (foreign key).
    const fondNameFromMetadata = findHoSoFondFieldValue(parsed)?.trim();
    if (!fondNameFromMetadata) {
        return;
    }

    const executor = tx ?? db;

    // Lookup fond by fond_name (case-insensitive).
    const allFonds = await db.select({ id: fonds.id, fondName: fonds.fondName })
        .from(fonds);

    const matched = allFonds.find(
        (f) => f.fondName.trim().toLowerCase() === fondNameFromMetadata.toLowerCase(),
    );

    if (!matched) {
        console.warn(
            `[syncDossierFondIdFromMetadata] No fond found with name "${fondNameFromMetadata}" — skipping fondId sync for dossier ${dossierId}`,
        );
        return;
    }

    await executor
        .update(dossiers)
        .set({
            fondId: matched.id,
            updatedAt: new Date(),
        })
        .where(activeDossierWhere(eq(dossiers.id, dossierId)));
}
