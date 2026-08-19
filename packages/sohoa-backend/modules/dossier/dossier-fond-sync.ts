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

import { resolveFondIdFromMetadataValue } from "../archive/archive-metadata-sync.ts";

export async function syncDossierFondIdFromMetadata(
    dossierId: string,
    metadata: unknown,
    tx?: DbTx,
): Promise<string | null> {
    if (!isDossierMetadata(metadata)) {
        return null;
    }

    const parsed = parseDossierMetadata(metadata);
    const fondRaw = findHoSoFondFieldValue(parsed)?.trim();
    if (!fondRaw) {
        return null;
    }

    const fondId = await resolveFondIdFromMetadataValue(fondRaw, tx);
    if (!fondId) {
        return null;
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

    return fondId;
}
