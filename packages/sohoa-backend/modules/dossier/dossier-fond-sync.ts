import { eq } from "drizzle-orm";
import {
    findHoSoFondFieldValue,
    parseDossierMetadata,
} from "../../libs/metadata-normalize.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import { activeDossierWhere } from "./active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";

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
    const fondId = findHoSoFondFieldValue(parsed)?.trim();
    if (!fondId) {
        return;
    }

    const executor = tx ?? db;
    await executor
        .update(dossiers)
        .set({
            fondId,
            updatedAt: new Date(),
        })
        .where(activeDossierWhere(eq(dossiers.id, dossierId)));
}
