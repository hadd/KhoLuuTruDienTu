import { and, desc, eq, max, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { metadataHistory } from "../../db/schemas/metadata-history.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import {
    downloadJsonFromStorage,
    uploadJsonToStorage,
    buildLinkGet,
    resolveMetadataJsonKey,
} from "../data-entry/data-entry-s3-utils.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import type { DossierStatus as DossierStatusType, WorkerRole as WorkerRoleType } from "../../db/schemas/workflow-constants.ts";

import { computeFieldDiff } from "./metadata-history-diff.ts";
import { shouldRecordMetadataSnapshot, type FieldChanges } from "./metadata-history-policy.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";

export type { FieldChanges } from "./metadata-history-policy.ts";
export { shouldRecordMetadataSnapshot } from "./metadata-history-policy.ts";
export { computeFieldDiff, flattenFields, normalizeFieldValue } from "./metadata-history-diff.ts";

export interface RecordSnapshotParams {
    dossierId: string;
    actorId: string | null;
    role: WorkerRoleType | null;
    action: string;
    fromStatus: DossierStatusType | null;
    toStatus: DossierStatusType | null;
    s3Key: string;
    /** Metadata key before this change; used as diff baseline. Falls back to latest history entry. */
    previousS3Key?: string | null;
    notes?: string | null;
}

async function resolveBaselineKey(
    dossierId: string,
    previousS3Key?: string | null,
): Promise<string | null> {
    if (previousS3Key) {
        return normalizeStorageKey(previousS3Key);
    }
    return await getPreviousSnapshot(dossierId);
}

async function getNextVersionNumber(dossierId: string): Promise<number> {
    const [row] = await db
        .select({ maxVersion: max(metadataHistory.versionNumber) })
        .from(metadataHistory)
        .where(eq(metadataHistory.dossierId, dossierId));
    return (row?.maxVersion ?? 0) + 1;
}

async function getPreviousSnapshot(dossierId: string): Promise<string | null> {
    const row = await db.query.metadataHistory.findFirst({
        where: eq(metadataHistory.dossierId, dossierId),
        orderBy: [desc(metadataHistory.versionNumber)],
        columns: { s3Key: true },
    });
    return row?.s3Key ?? null;
}

async function getLatestHistoryEntry(dossierId: string) {
    return await db.query.metadataHistory.findFirst({
        where: eq(metadataHistory.dossierId, dossierId),
        orderBy: [desc(metadataHistory.versionNumber)],
        columns: { action: true, s3Key: true },
    });
}

export async function hasOcrCompletedHistory(dossierId: string): Promise<boolean> {
    const row = await db.query.metadataHistory.findFirst({
        where: and(
            eq(metadataHistory.dossierId, dossierId),
            eq(metadataHistory.action, "OCR_COMPLETED"),
        ),
        columns: { id: true },
    });
    return !!row;
}

export async function recordSnapshot(params: RecordSnapshotParams): Promise<void> {
    const {
        dossierId, actorId, role, action,
        fromStatus, toStatus, s3Key, notes,
    } = params;

    const normalizedS3Key = normalizeStorageKey(s3Key);

    // Only skip idempotent retries (same action + key as the latest entry).
    const latestHistory = await getLatestHistoryEntry(dossierId);
    if (
        latestHistory
        && latestHistory.action === action
        && latestHistory.s3Key === normalizedS3Key
    ) {
        return;
    }

    let fieldChanges: FieldChanges | null = null;
    let diffComputed = false;

    let baselineKey = await resolveBaselineKey(dossierId, params.previousS3Key);
    if (baselineKey && baselineKey === normalizedS3Key) {
        const lastHistoryKey = await getPreviousSnapshot(dossierId);
        if (lastHistoryKey && lastHistoryKey !== normalizedS3Key) {
            baselineKey = lastHistoryKey;
        }
    }

    if (baselineKey && baselineKey === normalizedS3Key) {
        diffComputed = true;
        fieldChanges = null;
    } else if (baselineKey) {
        try {
            const [oldRaw, newRaw] = await Promise.all([
                downloadJsonFromStorage(resolveMetadataJsonKey(baselineKey)),
                downloadJsonFromStorage(resolveMetadataJsonKey(normalizedS3Key)),
            ]);
            if (isDossierMetadata(oldRaw) && isDossierMetadata(newRaw)) {
                fieldChanges = computeFieldDiff(oldRaw, newRaw);
                diffComputed = true;
            } else {
                console.error("[MetadataHistory] Invalid metadata format for diff", {
                    dossierId,
                    action,
                    baselineKey,
                    s3Key: normalizedS3Key,
                });
            }
        } catch (err) {
            console.error("[MetadataHistory] Failed to compute field diff:", err);
        }
    } else {
        // First snapshot for this dossier (e.g. OCR baseline) — no prior version to diff.
        diffComputed = true;
    }

    if (!shouldRecordMetadataSnapshot({ action, fieldChanges, diffComputed })) {
        return;
    }

    const versionNumber = await getNextVersionNumber(dossierId);

    const [historyRow] = await db.insert(metadataHistory).values({
        dossierId,
        actorId: actorId ?? null,
        role: role ?? null,
        action,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        s3Key: normalizedS3Key,
        fieldChanges: fieldChanges ?? null,
        versionNumber,
        notes: notes ?? null,
    }).returning();

    logActivity({
        userId: actorId,
        module: "data-entry",
        eventType: action === "approve" ? "approve" : action === "reject" ? "reject" : "edit",
        summary: `Cập nhật metadata hồ sơ (v${versionNumber})`,
        entityType: "dossier",
        entityId: dossierId,
        sourceLogId: historyRow?.id ?? null,
        requestMeta: {
            method: "EVENT",
            path: `/data-entry/dossiers/${dossierId}/metadata`,
            statusCode: 200,
            action: `metadata-${action}`,
        },
    });
}

export async function listHistory(dossierId: string) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { id: true },
    });
    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    const rows = await db
        .select({
            id: metadataHistory.id,
            versionNumber: metadataHistory.versionNumber,
            action: metadataHistory.action,
            role: metadataHistory.role,
            fromStatus: metadataHistory.fromStatus,
            toStatus: metadataHistory.toStatus,
            fieldChanges: metadataHistory.fieldChanges,
            notes: metadataHistory.notes,
            createdAt: metadataHistory.createdAt,
            actorId: metadataHistory.actorId,
            actorName: userProfiles.fullName,
            actorEmail: userProfiles.email,
        })
        .from(metadataHistory)
        .leftJoin(userProfiles, eq(metadataHistory.actorId, userProfiles.id))
        .where(eq(metadataHistory.dossierId, dossierId))
        .orderBy(desc(metadataHistory.versionNumber));

    return rows;
}

export async function getVersionContent(dossierId: string, historyId: string) {
    const row = await db.query.metadataHistory.findFirst({
        where: and(
            eq(metadataHistory.dossierId, dossierId),
            eq(metadataHistory.id, historyId),
        ),
    });
    if (!row) {
        throw httpError.notFound("History version not found");
    }

    const metadata = await downloadJsonFromStorage(resolveMetadataJsonKey(row.s3Key));

    return {
        id: row.id,
        versionNumber: row.versionNumber,
        action: row.action,
        role: row.role,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        fieldChanges: row.fieldChanges,
        notes: row.notes,
        createdAt: row.createdAt,
        s3Key: row.s3Key,
        metadata,
    };
}

export async function restoreVersion(
    dossierId: string,
    historyId: string,
    actorId: string,
): Promise<{ versionNumber: number; s3Key: string }> {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { id: true, ocrMetadataKey: true, currentMetadataKey: true, status: true },
    });
    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    const historyRow = await db.query.metadataHistory.findFirst({
        where: and(
            eq(metadataHistory.dossierId, dossierId),
            eq(metadataHistory.id, historyId),
        ),
        columns: { id: true, s3Key: true, versionNumber: true },
    });
    if (!historyRow) {
        throw httpError.notFound("History version not found");
    }

    const previousMetadataKey = dossier.currentMetadataKey;

    // Download the historical metadata content.
    const content = await downloadJsonFromStorage(
        resolveMetadataJsonKey(historyRow.s3Key),
    );

    // Build a new restore key based on the OCR key base or the source key.
    const base = (dossier.ocrMetadataKey ?? historyRow.s3Key)
        .replace(/\.json$/i, "")
        .replace(/_EDITOR(_A\d+)?$/i, "")
        .replace(/_CHECKER_\d+(_A\d+)?$/i, "");
    const restoreKey = `${base}_RESTORED_${historyId.slice(0, 8)}.json`;

    const storedKey = await uploadJsonToStorage(restoreKey, content);

    await db
        .update(dossiers)
        .set({ currentMetadataKey: storedKey, updatedAt: new Date() })
        .where(eq(dossiers.id, dossierId));

    await recordSnapshot({
        dossierId,
        actorId,
        role: null,
        action: "RESTORE_VERSION",
        fromStatus: dossier.status,
        toStatus: dossier.status,
        s3Key: storedKey,
        previousS3Key: previousMetadataKey,
        notes: `Restored from version ${historyRow.versionNumber} (history id: ${historyId})`,
    });

    const newRow = await db.query.metadataHistory.findFirst({
        where: eq(metadataHistory.dossierId, dossierId),
        orderBy: [desc(metadataHistory.versionNumber)],
        columns: { versionNumber: true, s3Key: true },
    });

    return {
        versionNumber: newRow!.versionNumber,
        s3Key: storedKey,
    };
}
