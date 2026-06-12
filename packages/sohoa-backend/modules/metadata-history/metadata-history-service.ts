import { and, desc, eq, max, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { metadataHistory } from "../../db/schemas/metadata-history.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    downloadJsonFromStorage,
    uploadJsonToStorage,
    buildLinkGet,
    resolveMetadataJsonKey,
} from "../data-entry/data-entry-s3-utils.ts";
import { isDossierMetadata, type DossierMetadata } from "../../libs/metadata-types.ts";
import type { DossierStatus as DossierStatusType, WorkerRole as WorkerRoleType } from "../../db/schemas/workflow-constants.ts";

export type FieldChanges = Record<string, { old: string | null; new: string | null }>;

export interface RecordSnapshotParams {
    dossierId: string;
    actorId: string | null;
    role: WorkerRoleType | null;
    action: string;
    fromStatus: DossierStatusType | null;
    toStatus: DossierStatusType | null;
    s3Key: string;
    notes?: string | null;
}

function flattenFields(meta: DossierMetadata): Map<string, string | null> {
    const map = new Map<string, string | null>();
    for (const group of meta.metadata_groups) {
        for (const field of group.fields) {
            map.set(`${group.group_code}.${field.name}`, field.value);
        }
    }
    return map;
}

function computeFieldDiff(
    oldMeta: DossierMetadata,
    newMeta: DossierMetadata,
): FieldChanges | null {
    const oldMap = flattenFields(oldMeta);
    const newMap = flattenFields(newMeta);
    const changes: FieldChanges = {};

    for (const [key, newVal] of newMap) {
        const oldVal = oldMap.get(key) ?? null;
        if (oldVal !== newVal) {
            changes[key] = { old: oldVal, new: newVal };
        }
    }

    return Object.keys(changes).length > 0 ? changes : null;
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

export async function recordSnapshot(params: RecordSnapshotParams): Promise<void> {
    const {
        dossierId, actorId, role, action,
        fromStatus, toStatus, s3Key, notes,
    } = params;

    let fieldChanges: FieldChanges | null = null;

    try {
        const previousKey = await getPreviousSnapshot(dossierId);
        if (previousKey) {
            const [oldRaw, newRaw] = await Promise.all([
                downloadJsonFromStorage(resolveMetadataJsonKey(previousKey)),
                downloadJsonFromStorage(resolveMetadataJsonKey(s3Key)),
            ]);
            if (isDossierMetadata(oldRaw) && isDossierMetadata(newRaw)) {
                fieldChanges = computeFieldDiff(oldRaw, newRaw);
            }
        }
    } catch {
        // Diff is best-effort; proceed without it if download fails.
    }

    const versionNumber = await getNextVersionNumber(dossierId);

    await db.insert(metadataHistory).values({
        dossierId,
        actorId: actorId ?? null,
        role: role ?? null,
        action,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        s3Key,
        fieldChanges: fieldChanges ?? null,
        versionNumber,
        notes: notes ?? null,
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
        columns: { id: true, ocrMetadataKey: true, status: true },
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

    // Download the historical metadata content.
    const content = await downloadJsonFromStorage(
        resolveMetadataJsonKey(historyRow.s3Key),
    );

    // Build a new restore key based on the OCR key base or the source key.
    const base = (dossier.ocrMetadataKey ?? historyRow.s3Key)
        .replace(/\.json$/i, "")
        .replace(/_EDITOR$/i, "")
        .replace(/_CHECKER_\d+$/i, "");
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
