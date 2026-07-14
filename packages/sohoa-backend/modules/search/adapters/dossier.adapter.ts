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
import { dossiers } from "../../../db/schemas/dossier.ts";
import { fonds } from "../../../db/schemas/fond.ts";
import { DossierStatus } from "../../../db/schemas/workflow-constants.ts";
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

    const assigneeIds = await getAssigneeIds(dossierId);

    let fondName: string | null = null;
    if (dossier.fondId) {
        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, dossier.fondId), isNull(fonds.deletedAt)),
            columns: { fondName: true },
        });
        fondName = fond?.fondName ?? null;
    }

    return {
        entityType: DOSSIER_ENTITY_TYPE,
        entityId: dossier.id,
        title: dossier.name,
        hoSoId: ocrMetadata?.ho_so_id ?? null,
        trangThaiHoSo: ocrMetadata?.trang_thai_ho_so ?? null,
        fields,
        fondId: dossier.fondId,
        dossierTypeId: dossier.dossierTypeId ?? null,
        projectCode: dossier.projectCode,
        dossierStatus: dossier.status,
        archiveSubmissionId: submission?.id ?? null,
        acl: {
            fondIds: dossier.fondId ? [dossier.fondId] : [],
            projectCodes: dossier.projectCode ? [dossier.projectCode] : [],
            assigneeIds,
        },
        metadata: {
            folderPath: dossier.folderPath,
            status: dossier.status,
            fondName,
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
