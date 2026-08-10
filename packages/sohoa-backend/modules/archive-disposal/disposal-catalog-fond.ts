import { and, eq, inArray, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { disposalProposalItems } from "../../db/schemas/archive-disposal.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import {
    mergeFailureMessage,
    mergeFondIds,
    type MergeFondIdsFailureCode,
} from "./disposal-catalog-fond-rules.ts";

export type { MergeFondIdsFailureCode, MergeFondIdsResult } from "./disposal-catalog-fond-rules.ts";
export { mergeFondIds } from "./disposal-catalog-fond-rules.ts";

export async function loadDossierFondIds(
    dossierIds: string[],
): Promise<Map<string, string | null>> {
    if (dossierIds.length === 0) return new Map();

    const rows = await db
        .select({ id: dossiers.id, fondId: dossiers.fondId })
        .from(dossiers)
        .where(inArray(dossiers.id, dossierIds));

    const map = new Map<string, string | null>();
    for (const row of rows) {
        map.set(row.id, row.fondId);
    }
    return map;
}

export async function loadCatalogFondIds(catalogId: string): Promise<string[]> {
    const rows = await db
        .select({ fondId: dossiers.fondId })
        .from(disposalProposalItems)
        .innerJoin(dossiers, eq(dossiers.id, disposalProposalItems.dossierId))
        .where(eq(disposalProposalItems.catalogId, catalogId));

    const ids = new Set<string>();
    for (const row of rows) {
        const trimmed = row.fondId?.trim();
        if (trimmed) ids.add(trimmed);
    }
    return [...ids];
}

export async function resolveFondDisplayName(
    fondId: string,
): Promise<string | null> {
    const [row] = await db
        .select({ fondName: fonds.fondName })
        .from(fonds)
        .where(and(eq(fonds.id, fondId), isNull(fonds.deletedAt)))
        .limit(1);
    return row?.fondName?.trim() ?? null;
}

export async function resolveCatalogFondMeta(catalogId: string): Promise<{
    catalogFondId: string | null;
    catalogFondName: string | null;
}> {
    const fondIds = await loadCatalogFondIds(catalogId);
    if (fondIds.length !== 1) {
        return { catalogFondId: null, catalogFondName: null };
    }
    const catalogFondId = fondIds[0]!;
    const catalogFondName = await resolveFondDisplayName(catalogFondId);
    return { catalogFondId, catalogFondName };
}

export async function assertCatalogFondConsistency(
    catalogId: string,
    dossierIds: string[],
): Promise<void> {
    const uniqueDossierIds = [...new Set(dossierIds)];
    if (uniqueDossierIds.length === 0) return;

    const [fondByDossier, existingFondIds] = await Promise.all([
        loadDossierFondIds(uniqueDossierIds),
        loadCatalogFondIds(catalogId),
    ]);

    const missing = uniqueDossierIds.filter((id) => !fondByDossier.has(id));
    if (missing.length > 0) {
        throw httpError.notFound("Không tìm thấy hồ sơ");
    }

    const incomingFondIds = uniqueDossierIds.map((id) => fondByDossier.get(id) ?? null);
    const merged = mergeFondIds(existingFondIds, incomingFondIds);
    if (merged.ok) return;

    let catalogFondName: string | null = null;
    if (merged.code === "MIXED_FOND" && existingFondIds.length === 1) {
        catalogFondName = await resolveFondDisplayName(existingFondIds[0]!);
    }

    const message = mergeFailureMessage(merged.code, catalogFondName);
    if (merged.code === "CATALOG_MIXED_FOND") {
        throw httpError.conflict(message);
    }
    throw httpError.badRequest(message);
}
