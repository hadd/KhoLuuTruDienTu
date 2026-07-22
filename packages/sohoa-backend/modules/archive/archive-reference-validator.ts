import { and, eq, isNull } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    ArchiveReferenceSource,
    type ArchiveReferenceSource as ArchiveReferenceSourceType,
} from "../../db/schemas/archive-constants.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import { retentionPeriods } from "../../db/schemas/retention-period.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import { formatRetentionDurationLabel } from "../retention-period/format-duration-label.ts";
import {
    assertBottomLevelItem,
    assertItemHasCapacity,
    resolvePhysicalItemBreadcrumb,
} from "../physical-warehouse/physical-placement-service.ts";

const REFERENCE_SOURCE_LABELS: Record<ArchiveReferenceSourceType, string> = {
    [ArchiveReferenceSource.FOND]: "Phông lưu trữ",
    [ArchiveReferenceSource.INVENTORY]: "Mục lục",
    [ArchiveReferenceSource.RETENTION_PERIOD]: "Thời hạn lưu trữ",
    [ArchiveReferenceSource.DOSSIER_TYPE]: "Loại hồ sơ",
    [ArchiveReferenceSource.PHYSICAL_BOTTOM_ITEM]: "Hộp, cặp",
};

export function getReferenceSourceLabel(source: ArchiveReferenceSourceType): string {
    return REFERENCE_SOURCE_LABELS[source];
}

export async function validateReferenceValue(
    source: ArchiveReferenceSourceType,
    id: string,
): Promise<void> {
    if (source === ArchiveReferenceSource.PHYSICAL_BOTTOM_ITEM) {
        await assertBottomLevelItem(id);
        await assertItemHasCapacity(id, 1);
        return;
    }
    const label = await resolveReferenceLabel(source, id);
    if (!label) {
        throw httpError.badRequest(
            `${getReferenceSourceLabel(source)} không tồn tại hoặc không hợp lệ`,
        );
    }
}

export async function resolveReferenceLabel(
    source: ArchiveReferenceSourceType,
    id: string,
): Promise<string | null> {
    switch (source) {
        case ArchiveReferenceSource.FOND: {
            const [row] = await db
                .select({ label: fonds.fondName })
                .from(fonds)
                .where(and(
                    eq(fonds.id, id),
                    eq(fonds.isActive, true),
                    isNull(fonds.deletedAt),
                ))
                .limit(1);
            return row?.label ?? null;
        }
        case ArchiveReferenceSource.INVENTORY: {
            const [row] = await db
                .select({ label: inventories.name })
                .from(inventories)
                .where(and(
                    eq(inventories.id, id),
                    eq(inventories.isActive, true),
                ))
                .limit(1);
            return row?.label ?? null;
        }
        case ArchiveReferenceSource.RETENTION_PERIOD: {
            const [row] = await db
                .select({
                    isPermanent: retentionPeriods.isPermanent,
                    durationValue: retentionPeriods.durationValue,
                    durationUnit: retentionPeriods.durationUnit,
                })
                .from(retentionPeriods)
                .where(and(
                    eq(retentionPeriods.id, id),
                    eq(retentionPeriods.isActive, true),
                ))
                .limit(1);
            return row ? formatRetentionDurationLabel(row) : null;
        }
        case ArchiveReferenceSource.DOSSIER_TYPE: {
            const [row] = await db
                .select({ label: dossierTypes.name })
                .from(dossierTypes)
                .where(and(
                    eq(dossierTypes.id, id),
                    eq(dossierTypes.isActive, true),
                ))
                .limit(1);
            return row?.label ?? null;
        }
        case ArchiveReferenceSource.PHYSICAL_BOTTOM_ITEM: {
            return await resolvePhysicalItemBreadcrumb(id);
        }
        default:
            return null;
    }
}

export async function validateInventoryBelongsToFond(
    inventoryId: string,
    fondId: string,
): Promise<void> {
    const [row] = await db
        .select({ fondId: inventories.fondId })
        .from(inventories)
        .where(and(
            eq(inventories.id, inventoryId),
            eq(inventories.isActive, true),
        ))
        .limit(1);

    if (!row) {
        throw httpError.badRequest("Mục lục không tồn tại hoặc đã ngưng hoạt động");
    }
    if (row.fondId !== fondId) {
        throw httpError.badRequest("Mục lục không thuộc phông đã chọn");
    }
}
