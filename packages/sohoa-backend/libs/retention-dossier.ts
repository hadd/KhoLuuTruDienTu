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

  const max = pickMaxRetentionPeriod(periods);
  return max ? toEffectiveRetention(max) : null;
}
