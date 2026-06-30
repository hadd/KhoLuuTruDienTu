import { httpError } from "@shared/common-lib";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { toSignedPdfKey } from "../dossier/dossier-path-utils.ts";
import {
    computePreparedPdfHash,
    createSignedPdfFromOriginal,
    verifySignedPdf,
} from "./digital-sign-pdf-utils.ts";
import * as repo from "./digital-sign-repo.ts";
import {
    downloadPdfFromStorage,
    readSignedPdfFromStorage,
    uploadSignedPdfToStorage,
} from "./digital-sign-s3-utils.ts";
import type {
    prepareBatchBodySchema,
    prepareDossierBodySchema,
    submitSignatureBodySchema,
} from "./digital-sign-schema.ts";

function parseOptionalDate(value?: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPdfFile(fileName: string, filePath: string): boolean {
    return fileName.toLowerCase().endsWith(".pdf") || filePath.toLowerCase().endsWith(".pdf");
}

async function buildPrepareItems(files: Awaited<ReturnType<typeof repo.findSignableFilesByDossierId>>) {
    const items = [];

    for (const file of files) {
        if (!isPdfFile(file.fileName, file.filePath)) {
            continue;
        }

        const pdfBytes = await downloadPdfFromStorage(file.filePath);
        const hashBase64 = await computePreparedPdfHash(pdfBytes);

        items.push({
            fileId: file.id,
            fileName: file.fileName,
            filePath: file.filePath,
            hashBase64,
        });
    }

    return items;
}

export const DigitalSignService = {
    async prepareDossier(input: Static<typeof prepareDossierBodySchema>) {
        const dossier = await repo.findDossierById(input.dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const files = await repo.findSignableFilesByDossierId(input.dossierId);
        const items = await buildPrepareItems(files);

        return {
            dossierId: input.dossierId,
            dossierName: dossier.name,
            files: items,
            totalFiles: items.length,
        };
    },

    async prepareBatch(input: Static<typeof prepareBatchBodySchema>) {
        const dossierIds = [...new Set(input.dossierIds)];
        const files = await repo.findSignableFilesByDossierIds(dossierIds);
        const filesByDossier = new Map<string, typeof files>();

        for (const file of files) {
            const bucket = filesByDossier.get(file.dossierId) ?? [];
            bucket.push(file);
            filesByDossier.set(file.dossierId, bucket);
        }

        const dossiers = await Promise.all(
            dossierIds.map(async (dossierId) => {
                const dossier = await repo.findDossierById(dossierId);
                if (!dossier) {
                    throw httpError.notFound(`Dossier not found: ${dossierId}`);
                }

                const dossierFiles = filesByDossier.get(dossierId) ?? [];
                const items = await buildPrepareItems(dossierFiles);

                return {
                    dossierId,
                    dossierName: dossier.name,
                    files: items,
                    totalFiles: items.length,
                };
            }),
        );

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
        if (file.signedFilePath) {
            throw httpError.conflict("File has already been signed");
        }
        if (!isPdfFile(file.fileName, file.filePath)) {
            throw httpError.badRequest("Only PDF files can be digitally signed");
        }

        const signedKey = toSignedPdfKey(file.filePath);
        if (!signedKey) {
            throw httpError.badRequest("File path is not eligible for digital signing");
        }

        const originalPdf = await downloadPdfFromStorage(file.filePath);
        const signedPdf = await createSignedPdfFromOriginal(originalPdf, input.signatureBase64);

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

        await db.insert(workflowLogs).values({
            dossierId: file.dossierId,
            actorId,
            action: "DIGITAL_SIGN_FILE",
            notes: `Signed file ${file.fileName} (${input.certificateSubject})`,
        });

        return {
            fileId: file.id,
            dossierId: file.dossierId,
            signedFilePath: signedKey,
            verified: verification.valid,
        };
    },

    async getDossierSignStatus(dossierId: string) {
        const dossier = await repo.findDossierById(dossierId);
        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const files = await repo.listFileSignStatusByDossierId(dossierId);
        const signedCount = files.filter((file) => file.isSigned).length;

        return {
            dossierId,
            dossierName: dossier.name,
            totalFiles: files.length,
            signedFiles: signedCount,
            pendingFiles: files.length - signedCount,
            isFullySigned: files.length > 0 && signedCount === files.length,
            files,
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
