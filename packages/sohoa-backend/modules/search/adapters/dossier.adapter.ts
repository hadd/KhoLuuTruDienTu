import { and, desc, eq, isNull } from "drizzle-orm";
import type { SearchDocument } from "@shared/search-engine";
import { db } from "../../../db/db-conn.ts";
import {
    ArchiveSubmissionStatus,
} from "../../../db/schemas/archive-constants.ts";
import {
    archiveSubmissions,
    type ArchiveFieldConfigSnapshot,
    type ArchiveFieldValueSnapshot,
} from "../../../db/schemas/archive-submission.ts";
import { dossierAssignments } from "../../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../../db/schemas/dossier-file.ts";
import { dossiers } from "../../../db/schemas/dossier.ts";
import { dossierTypes } from "../../../db/schemas/dossier-type.ts";
import { fonds } from "../../../db/schemas/fond.ts";
import { userProfiles } from "../../../db/schemas/user_profile.ts";
import { DossierStatus, WorkerRole } from "../../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../../dossier/active-query-filters.ts";
import { downloadJsonFromStorage } from "../../data-entry/data-entry-s3-utils.ts";
import {
    extractOcrText,
    flattenOcrFields,
} from "../../../libs/flatten-ocr-fields.ts";
import {
    isDossierMetadata,
} from "../../../libs/metadata-types.ts";

export const DOSSIER_ENTITY_TYPE = "dossier";

export { extractOcrText, flattenOcrFields };

export function extractArchiveText(
    fieldValues: ArchiveFieldValueSnapshot,
    snapshot: ArchiveFieldConfigSnapshot,
): string {
    const parts: string[] = [];
    for (const field of snapshot.fields) {
        const value = fieldValues[field.fieldKey];
        if (typeof value === "string" && value.trim()) parts.push(value);
        const label = snapshot.resolvedLabels[field.fieldKey]?.label;
        if (label) parts.push(label);
    }
    return parts.join("\n");
}

export function isDossierSearchEligible(input: {
    deletedAt: Date | null;
    status: string;
    ocrMetadataKey: string | null;
    submissionStatus?: string | null;
}): boolean {
    if (input.deletedAt) return false;
    if (input.status !== DossierStatus.ARCHIVED) return false;
    if (!input.ocrMetadataKey) return false;
    if (input.submissionStatus !== ArchiveSubmissionStatus.APPROVED) return false;
    return true;
}

async function getApprovedSubmission(dossierId: string) {
    return db.query.archiveSubmissions.findFirst({
        where: and(
            eq(archiveSubmissions.dossierId, dossierId),
            eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
        ),
        orderBy: [desc(archiveSubmissions.reviewedAt)],
    });
}

async function getAssigneeIds(dossierId: string): Promise<string[]> {
    const rows = await db.query.dossierAssignments.findMany({
        where: eq(dossierAssignments.dossierId, dossierId),
        columns: { assigneeId: true },
    });
    return [...new Set(rows.map((row) => row.assigneeId))];
}

async function getFileNames(dossierId: string): Promise<string[]> {
    const rows = await db
        .select({ fileName: dossierFiles.fileName })
        .from(dossierFiles)
        .where(eq(dossierFiles.dossierId, dossierId))
        .orderBy(dossierFiles.fileName);
    return rows.map((row) => row.fileName).filter(Boolean);
}

async function getMakerEditors(dossierId: string): Promise<{
    editorIds: string[];
    editorNames: string[];
    editCompletedAt: string | null;
}> {
    const rows = await db
        .select({
            assigneeId: dossierAssignments.assigneeId,
            fullName: userProfiles.fullName,
            completedAt: dossierAssignments.completedAt,
        })
        .from(dossierAssignments)
        .innerJoin(userProfiles, eq(userProfiles.id, dossierAssignments.assigneeId))
        .where(
            and(
                eq(dossierAssignments.dossierId, dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
            ),
        )
        .orderBy(desc(dossierAssignments.completedAt));

    const completed = rows.filter((row) => row.completedAt != null);
    const source = completed.length > 0 ? completed : rows;

    const editorIds: string[] = [];
    const editorNames: string[] = [];
    const seen = new Set<string>();
    for (const row of source) {
        if (seen.has(row.assigneeId)) continue;
        seen.add(row.assigneeId);
        editorIds.push(row.assigneeId);
        if (row.fullName?.trim()) editorNames.push(row.fullName.trim());
    }

    const latestCompleted = completed[0]?.completedAt ?? null;
    return {
        editorIds,
        editorNames,
        editCompletedAt: latestCompleted ? latestCompleted.toISOString() : null,
    };
}

function resolveDossierTypeId(
    dossierTypeId: string | null | undefined,
    fieldValues: ArchiveFieldValueSnapshot | null | undefined,
): string | null {
    if (dossierTypeId) return dossierTypeId;
    const fromFields = fieldValues?.dossier_type;
    return typeof fromFields === "string" && fromFields.trim()
        ? fromFields.trim()
        : null;
}

export async function buildDossierSearchDocument(
    dossierId: string,
): Promise<SearchDocument | null> {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
    });
    if (!dossier) return null;

    const submission = await getApprovedSubmission(dossierId);
    if (
        !isDossierSearchEligible({
            deletedAt: dossier.deletedAt,
            status: dossier.status,
            ocrMetadataKey: dossier.ocrMetadataKey,
            submissionStatus: submission?.status ?? null,
        })
    ) {
        return null;
    }

    const metadataRaw = await downloadJsonFromStorage(dossier.ocrMetadataKey!);
    const ocrMetadata = isDossierMetadata(metadataRaw) ? metadataRaw : null;
    const fields = ocrMetadata ? flattenOcrFields(ocrMetadata) : [];

    const [assigneeIds, fileNames, makers] = await Promise.all([
        getAssigneeIds(dossierId),
        getFileNames(dossierId),
        getMakerEditors(dossierId),
    ]);

    let fondName: string | null = null;
    if (dossier.fondId) {
        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, dossier.fondId), isNull(fonds.deletedAt)),
            columns: { fondName: true },
        });
        fondName = fond?.fondName ?? null;
    }

    const dossierTypeId = resolveDossierTypeId(
        dossier.dossierTypeId,
        submission?.fieldValues,
    );
    let dossierTypeName: string | null = null;
    if (dossierTypeId) {
        const [typeRow] = await db
            .select({ name: dossierTypes.name })
            .from(dossierTypes)
            .where(eq(dossierTypes.id, dossierTypeId))
            .limit(1);
        dossierTypeName = typeRow?.name ?? null;
    }

    return {
        entityType: DOSSIER_ENTITY_TYPE,
        entityId: dossier.id,
        title: dossier.name,
        hoSoId: ocrMetadata?.ho_so_id ?? null,
        trangThaiHoSo: ocrMetadata?.trang_thai_ho_so ?? null,
        fields,
        fileNames,
        fondId: dossier.fondId,
        fondName,
        dossierTypeId,
        dossierTypeName,
        projectCode: dossier.projectCode,
        dossierStatus: dossier.status,
        archiveSubmissionId: submission?.id ?? null,
        editorIds: makers.editorIds,
        editorNames: makers.editorNames,
        editCompletedAt: makers.editCompletedAt,
        archivedAt: submission?.reviewedAt
            ? submission.reviewedAt.toISOString()
            : null,
        acl: {
            fondIds: dossier.fondId ? [dossier.fondId] : [],
            projectCodes: dossier.projectCode ? [dossier.projectCode] : [],
            assigneeIds,
        },
        metadata: {
            folderPath: dossier.folderPath,
            status: dossier.status,
            fondName,
            dossierTypeName,
            dossierCode: submission?.fieldValues
                ? Object.values(submission.fieldValues).find((v) => typeof v === "string") ?? null
                : null,
        },
    };
}

export async function indexDossierById(dossierId: string): Promise<boolean> {
    const { indexDocument, deleteDocument } = await import("@shared/search-engine");
    const doc = await buildDossierSearchDocument(dossierId);
    if (!doc) {
        await deleteDocument(DOSSIER_ENTITY_TYPE, dossierId);
        return false;
    }
    await indexDocument(doc);
    return true;
}
