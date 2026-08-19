import { eq } from "drizzle-orm";
import {
    findHoSoFondFieldValue,
    parseDossierMetadata,
} from "../../libs/metadata-normalize.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import { activeDossierWhere } from "./active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { resolveFondIdFromMetadataValue } from "../archive/archive-metadata-sync.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
        console.warn(
            `[syncDossierFondIdFromMetadata] No fond found for value "${fondRaw}" — skipping fondId sync for dossier ${dossierId}`,
        );
        return null;
    }

    const executor = tx ?? db;

    await executor
        .update(dossiers)
        .set({
            fondId,
            updatedAt: new Date(),
        })
        .where(activeDossierWhere(eq(dossiers.id, dossierId)));

    return fondId;
}

