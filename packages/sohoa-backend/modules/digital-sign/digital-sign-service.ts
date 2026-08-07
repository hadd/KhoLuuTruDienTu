import { httpError } from "@shared/common-lib";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { toSignedPdfKey } from "../dossier/dossier-path-utils.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import {
    createSignedPdfFromPrepared,
    preparePdfForSigning,
    verifySignedPdf,
    type VisualSignatureConfig,
} from "./digital-sign-pdf-utils.ts";
import * as repo from "./digital-sign-repo.ts";
import {
    deletePreparedSigningArtifacts,
    downloadPdfFromStorage,
    readPreparedSigningArtifacts,
    readSignedPdfFromStorage,
    uploadPreparedSigningArtifacts,
    uploadSignedPdfToStorage,
} from "./digital-sign-s3-utils.ts";
import type {
    prepareBatchBodySchema,
    prepareDossierBodySchema,
    submitSignatureBodySchema,
} from "./digital-sign-schema.ts";

/** Ký / ký lại chỉ khi hồ sơ chưa vào kho (chưa nộp / chưa lưu kho). */
const SIGNABLE_DOSSIER_STATUSES = new Set<string>([
    DossierStatus.APPROVED,
    DossierStatus.ARCHIVE_REJECTED,
]);

function assertDossierAllowsSigning(dossier: { id: string; name: string; status: string }) {
    if (dossier.status === DossierStatus.ARCHIVED) {
        throw httpError.conflict(
            "Hồ sơ đã lưu kho — không thể ký số / ký lại.",
        );
    }
    if (dossier.status === DossierStatus.PENDING_ARCHIVE) {
        throw httpError.conflict(
            "Hồ sơ đang chờ duyệt lưu kho — không thể ký số / ký lại.",
        );
    }
    if (!SIGNABLE_DOSSIER_STATUSES.has(dossier.status)) {
        throw httpError.badRequest(
            `Chỉ ký số được khi hồ sơ ở trạng thái đã duyệt (hiện tại: ${dossier.status}).`,
        );
    }
}

function parseOptionalDate(value?: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPdfFile(fileName: string, filePath: string): boolean {
    return fileName.toLowerCase().endsWith(".pdf") || filePath.toLowerCase().endsWith(".pdf");
}

type PrepareVisual = Static<typeof prepareDossierBodySchema>["visualSignature"];

async function buildPrepareItems(
    files: Awaited<ReturnType<typeof repo.findSignableFilesByDossierId>>,
    options?: {
        certificateSubject?: string;
        certificateIssuer?: string;
        certificateBase64?: string;
        visualSignature?: PrepareVisual;
        fileIds?: string[];
        fileVisualById?: Map<string, PrepareVisual>;
    },
) {
    const allowedIds = options?.fileIds?.length
        ? new Set(options.fileIds)
        : null;
    const items = [];

    for (const file of files) {
        if (allowedIds && !allowedIds.has(file.id)) {
            continue;
        }
        if (!isPdfFile(file.fileName, file.filePath)) {
            continue;
        }

        const visual =
            options?.fileVisualById?.get(file.id) ?? options?.visualSignature;

        // Always prepare from raw/ original so re-sign replaces the previous stamp.
        const pdfBytes = await downloadPdfFromStorage(file.filePath);
        const prepared = await preparePdfForSigning(pdfBytes, {
            subject: options?.certificateSubject,
            issuer: options?.certificateIssuer,
            certificateBase64: options?.certificateBase64,
            visualSignature: visual as VisualSignatureConfig | undefined,
        });

        await uploadPreparedSigningArtifacts(file.id, prepared.preparedPdf, {
            fileId: file.id,
            authAttrsDerBase64: prepared.authAttrsDerBase64,
            contentsOffset: prepared.contentsOffset,
            contentsLength: prepared.contentsLength,
            byteRange: prepared.byteRange,
            hashBase64: prepared.hashBase64,
        });

        items.push({
            fileId: file.id,
            fileName: file.fileName,
            filePath: file.filePath,
            hashBase64: prepared.hashBase64,
            isResign: Boolean(file.signedFilePath),
        });
    }

    return items;
}

function resolveFilePrepareFilter(input: {
    files?: Array<{ fileId: string; visualSignature?: PrepareVisual }>;
    fileIds?: string[];
}): { fileIds?: string[]; fileVisualById?: Map<string, PrepareVisual> } {
    if (input.files?.length) {
        const fileVisualById = new Map<string, PrepareVisual>();
        for (const item of input.files) {
            if (item.visualSignature) {
                fileVisualById.set(item.fileId, item.visualSignature);
            }
        }
        return {
            fileIds: input.files.map((f) => f.fileId),
            fileVisualById,
        };
    }
    if (input.fileIds?.length) {
        return { fileIds: input.fileIds };
    }
    return {};
}

export const DigitalSignService = {
    async prepareDossier(input: Static<typeof prepareDossierBodySchema>) {
        const dossier = await repo.findDossierById(input.dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }
        assertDossierAllowsSigning(dossier);

        const filter = resolveFilePrepareFilter(input);
        const files = await repo.findSignableFilesByDossierId(input.dossierId);
        const items = await buildPrepareItems(files, {
            certificateSubject: input.certificateSubject,
            certificateIssuer: input.certificateIssuer,
            certificateBase64: input.certificateBase64,
            visualSignature: input.visualSignature,
            ...filter,
        });

        return {
            dossierId: input.dossierId,
            dossierName: dossier.name,
            dossierStatus: dossier.status,
            files: items,
            totalFiles: items.length,
        };
    },

    async prepareBatch(input: Static<typeof prepareBatchBodySchema>) {
        const dossierIds = [...new Set(input.dossierIds)];
        const filter = resolveFilePrepareFilter(input);
        const files = await repo.findSignableFilesByDossierIds(dossierIds);
        const filesByDossier = new Map<string, typeof files>();

        for (const file of files) {
            const bucket = filesByDossier.get(file.dossierId) ?? [];
            bucket.push(file);
            filesByDossier.set(file.dossierId, bucket);
        }

        // Prepare dossiers one-by-one instead of Promise.all so a large batch
        // does not open many parallel S3/DB operations and starve the pool
        // (which previously surfaced as intermittent `connect EINVAL` on submit).
        const dossiers = [];
        for (const dossierId of dossierIds) {
            const dossier = await repo.findDossierById(dossierId);
            if (!dossier) {
                throw httpError.notFound(`Dossier not found: ${dossierId}`);
            }
            assertDossierAllowsSigning(dossier);

            const dossierFiles = filesByDossier.get(dossierId) ?? [];
            const items = await buildPrepareItems(dossierFiles, {
                certificateSubject: input.certificateSubject,
                certificateIssuer: input.certificateIssuer,
                certificateBase64: input.certificateBase64,
                visualSignature: input.visualSignature,
                ...filter,
            });

            dossiers.push({
                dossierId,
                dossierName: dossier.name,
                dossierStatus: dossier.status,
                files: items,
                totalFiles: items.length,
            });
        }

        return {
            dossiers,
            totalDossiers: dossiers.length,
            totalFiles: dossiers.reduce((sum, dossier) => sum + dossier.totalFiles, 0),
        };
    },

    async submitSignature(
        input: Static<typeof submitSignatureBodySchema>,
        actorId: string,
    ) {
        const file = await repo.findFileById(input.fileId);
        if (!file) {
            throw httpError.notFound("File not found");
        }

        const dossier = await repo.findDossierById(file.dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }
        assertDossierAllowsSigning(dossier);

        if (!isPdfFile(file.fileName, file.filePath)) {
            throw httpError.badRequest("Only PDF files can be digitally signed");
        }

        const isResign = Boolean(file.signedFilePath);
        const signedKey = toSignedPdfKey(file.filePath);
        if (!signedKey) {
            throw httpError.badRequest("File path is not eligible for digital signing");
        }

        let preparedPdf: Uint8Array;
        let meta: Awaited<ReturnType<typeof readPreparedSigningArtifacts>>["meta"];
        try {
            ({ preparedPdf, meta } = await readPreparedSigningArtifacts(file.id));
        } catch {
            throw httpError.badRequest(
                "Prepared signing session not found. Please run prepare again before submit.",
            );
        }

        const signedPdf = createSignedPdfFromPrepared({
            preparedPdf,
            signatureBase64: input.signatureBase64,
            certificateBase64: input.certificateBase64,
            authAttrsDerBase64: meta.authAttrsDerBase64,
            contentsOffset: meta.contentsOffset,
            contentsLength: meta.contentsLength,
        });

        const verification = await verifySignedPdf(signedPdf);
        if (!verification.valid) {
            throw httpError.badRequest(verification.reason ?? "Invalid digital signature");
        }

        await uploadSignedPdfToStorage(signedKey, signedPdf);

        await repo.markFileSigned({
            fileId: file.id,
            signedFilePath: signedKey,
            signedBy: actorId,
            certificateSubject: input.certificateSubject,
            certificateThumbprint: input.certificateThumbprint,
            certificateIssuer: input.certificateIssuer,
            certificateValidFrom: parseOptionalDate(input.certificateValidFrom),
            certificateValidTo: parseOptionalDate(input.certificateValidTo),
        });

        await deletePreparedSigningArtifacts(file.id);

        await db.insert(workflowLogs).values({
            dossierId: file.dossierId,
            actorId,
            action: isResign ? "DIGITAL_RESIGN_FILE" : "DIGITAL_SIGN_FILE",
            notes: isResign
                ? `Re-signed file ${file.fileName} (${input.certificateSubject})`
                : `Signed file ${file.fileName} (${input.certificateSubject})`,
        });

        return {
            fileId: file.id,
            dossierId: file.dossierId,
            signedFilePath: signedKey,
            verified: verification.valid,
            isResign,
        };
    },

    async getDossierSignStatus(dossierId: string) {
        const dossier = await repo.findDossierById(dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const files = await repo.listFileSignStatusByDossierId(dossierId);
        const signedCount = files.filter((file) => file.isSigned).length;
        const allowsSigning = SIGNABLE_DOSSIER_STATUSES.has(dossier.status);

        const filesWithUrl = await Promise.all(
            files.map(async (file) => ({
                ...file,
                fileUrl: (await buildLinkGet(file.filePath)) ?? "",
            })),
        );

        return {
            dossierId,
            dossierName: dossier.name,
            dossierStatus: dossier.status,
            allowsSigning,
            totalFiles: files.length,
            signedFiles: signedCount,
            pendingFiles: files.length - signedCount,
            isFullySigned: files.length > 0 && signedCount === files.length,
            files: filesWithUrl,
        };
    },

    async verifyFileSignature(fileId: string) {
        const file = await repo.findFileById(fileId);
        if (!file) {
            throw httpError.notFound("File not found");
        }
        if (!file.signedFilePath) {
            throw httpError.badRequest("File has not been signed yet");
        }

        const signedPdf = await readSignedPdfFromStorage(file.signedFilePath);
        const verification = await verifySignedPdf(signedPdf);

        return {
            fileId: file.id,
            dossierId: file.dossierId,
            signedFilePath: file.signedFilePath,
            ...verification,
        };
    },

    async listDossierSignatureHistory(dossierId: string) {
        const dossier = await repo.findDossierById(dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        return await repo.listSignaturesByDossierId(dossierId);
    },
};
