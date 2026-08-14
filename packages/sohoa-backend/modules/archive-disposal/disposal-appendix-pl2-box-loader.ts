import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/db-conn.ts";
import { dossierPhysicalPlacements } from "../../db/schemas/dossier-physical-placement.ts";
import { DossierPhysicalPlacementStatus } from "../../db/schemas/dossier-physical-placement-constants.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";

import { extractBoxNumberFromPhysicalItemName } from "./disposal-appendix-pl2-rows.ts";

export async function loadPhysicalBoxNumbersByDossierIds(
    dossierIds: string[],
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (dossierIds.length === 0) return map;

    const rows = await db
        .select({
            dossierId: dossierPhysicalPlacements.dossierId,
            itemName: physicalWarehouseItems.name,
        })
        .from(dossierPhysicalPlacements)
        .innerJoin(
            physicalWarehouseItems,
            eq(physicalWarehouseItems.id, dossierPhysicalPlacements.physicalItemId),
        )
        .where(
            and(
                inArray(dossierPhysicalPlacements.dossierId, dossierIds),
                eq(
                    dossierPhysicalPlacements.status,
                    DossierPhysicalPlacementStatus.ACTIVE,
                ),
            ),
        );

    for (const row of rows) {
        map.set(
            row.dossierId,
            extractBoxNumberFromPhysicalItemName(row.itemName ?? ""),
        );
    }
    return map;
}
