import { eq, inArray } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { documentTypes } from "../db/schemas/document-type.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { retentionPeriods } from "../db/schemas/retention-period.ts";
import {
  type EffectiveRetention,
  pickMaxRetentionPeriod,
  toEffectiveRetention,
} from "./retention-compare.ts";
import { formatRetentionDurationLabel } from "../modules/retention-period/format-duration-label.ts";

/**
 * Thời hạn lưu trữ hồ sơ = max retention của các loại tài liệu
 * gắn file trong hồ sơ (1 file → 1 loại TL).
 */
export async function resolveDossierEffectiveRetention(
  dossierId: string,
): Promise<EffectiveRetention | null> {
  const fileTypeRows = await db
    .select({ documentTypeId: dossierFiles.documentTypeId })
    .from(dossierFiles)
    .where(eq(dossierFiles.dossierId, dossierId));

  const typeIds = [
    ...new Set(
      fileTypeRows
        .map((r) => r.documentTypeId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (typeIds.length === 0) return null;

  const typeRows = await db
    .select({
      retentionPeriodId: documentTypes.retentionPeriodId,
    })
    .from(documentTypes)
    .where(inArray(documentTypes.id, typeIds));

  const retentionIds = [
    ...new Set(
      typeRows
        .map((r) => r.retentionPeriodId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (retentionIds.length === 0) return null;

    const periods = await db
        .select({
            id: retentionPeriods.id,
            isPermanent: retentionPeriods.isPermanent,
            durationValue: retentionPeriods.durationValue,
            durationUnit: retentionPeriods.durationUnit,
        })
        .from(retentionPeriods)
        .where(inArray(retentionPeriods.id, retentionIds));

    const periodsWithName = periods.map((period) => ({
        ...period,
        name: formatRetentionDurationLabel(period),
    }));

    const max = pickMaxRetentionPeriod(periodsWithName);
    return max ? toEffectiveRetention(max) : null;
}

/** Batch variant for list screens (expiry review, etc.). */
export async function resolveDossierEffectiveRetentionBatch(
    dossierIds: string[],
): Promise<Map<string, EffectiveRetention | null>> {
    const result = new Map<string, EffectiveRetention | null>();
    if (dossierIds.length === 0) return result;

    const fileRows = await db
        .select({
            dossierId: dossierFiles.dossierId,
            documentTypeId: dossierFiles.documentTypeId,
        })
        .from(dossierFiles)
        .where(inArray(dossierFiles.dossierId, dossierIds));

    const typeIdsByDossier = new Map<string, Set<string>>();
    for (const row of fileRows) {
        const typeId = row.documentTypeId?.trim();
        if (!typeId) continue;
        let set = typeIdsByDossier.get(row.dossierId);
        if (!set) {
            set = new Set();
            typeIdsByDossier.set(row.dossierId, set);
        }
        set.add(typeId);
    }

    const allTypeIds = [
        ...new Set(
            fileRows
                .map((r) => r.documentTypeId?.trim())
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    const typeRetentionMap = new Map<string, string | null>();
    if (allTypeIds.length > 0) {
        const typeRows = await db
            .select({
                id: documentTypes.id,
                retentionPeriodId: documentTypes.retentionPeriodId,
            })
            .from(documentTypes)
            .where(inArray(documentTypes.id, allTypeIds));
        for (const row of typeRows) {
            typeRetentionMap.set(row.id, row.retentionPeriodId?.trim() ?? null);
        }
    }

    const allRetentionIds = [
        ...new Set(
            [...typeRetentionMap.values()]
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    const periodById = new Map<string, EffectiveRetention>();
    if (allRetentionIds.length > 0) {
        const periods = await db
            .select({
                id: retentionPeriods.id,
                isPermanent: retentionPeriods.isPermanent,
                durationValue: retentionPeriods.durationValue,
                durationUnit: retentionPeriods.durationUnit,
            })
            .from(retentionPeriods)
            .where(inArray(retentionPeriods.id, allRetentionIds));

        for (const period of periods) {
            periodById.set(period.id, toEffectiveRetention({
                ...period,
                name: formatRetentionDurationLabel(period),
            }));
        }
    }

    for (const dossierId of dossierIds) {
        const typeIds = typeIdsByDossier.get(dossierId);
        if (!typeIds || typeIds.size === 0) {
            result.set(dossierId, null);
            continue;
        }
        const periods = [...typeIds]
            .map((typeId) => typeRetentionMap.get(typeId))
            .filter((id): id is string => Boolean(id))
            .map((id) => periodById.get(id))
            .filter((p): p is EffectiveRetention => Boolean(p))
            .map((p) => ({
                id: p.id,
                name: p.name,
                isPermanent: p.isPermanent,
                durationValue: p.durationValue,
                durationUnit: p.durationUnit,
            }));

        const max = pickMaxRetentionPeriod(periods);
        result.set(dossierId, max ? toEffectiveRetention(max) : null);
    }

    return result;
}
