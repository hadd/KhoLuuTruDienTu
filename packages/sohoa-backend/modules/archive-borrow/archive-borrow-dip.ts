import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    ArchiveBorrowDipLayout,
    ArchiveBorrowDipStatus,
} from "../../db/schemas/archive-borrow-constants.ts";
import {
    archiveBorrowDipPackages,
    type ArchiveBorrowDipManifest,
    type ArchiveBorrowDipManifestEntry,
} from "../../db/schemas/archive-borrow.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import { downloadExportPdf } from "../data-entry/data-entry-s3-utils.ts";
import {
    applyWatermarkConfigToPdfFiles,
    resolveWatermarkApplyConfig,
} from "../../libs/watermark/index.ts";
import { resolveApplyWatermarkForDossiers } from "../security-level/security-enforcement.ts";

export function resolveBorrowDipPrefix(): string {
    return normalizeStorageKey(env.STORAGE_BORROW_DIP_PREFIX ?? "DIP").replace(
        /\/+$/,
        "",
    );
}

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

function sha256HexBytes(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

export function buildBorrowDipObjectKey(
    requestId: string,
    fileId: string,
    fileName: string,
): string {
    const safeName = fileName.replace(/[\\/]+/g, "_").trim() || `${fileId}.pdf`;
    return `${resolveBorrowDipPrefix()}/${requestId}/${fileId}-${safeName}`;
}

async function ensureBorrowDipPrefixMarker(): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }
    const bucket = resolveS3Bucket();
    const prefix = `${resolveBorrowDipPrefix()}/`;
    try {
        await s3.getMinIOClient().putObject(bucket, prefix, Buffer.from(""));
    } catch {
        // Prefix marker is best-effort; object uploads still create the virtual folder.
    }
}

async function uploadBorrowDipObject(
    objectKey: string,
    data: Uint8Array,
): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }
    const bucket = resolveS3Bucket();
    const body = Buffer.from(data);
    await s3.getMinIOClient().putObject(
        bucket,
        objectKey,
        body,
        body.byteLength,
        { "Content-Type": "application/pdf" },
    );
}

async function deleteBorrowDipObject(objectKey: string): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) return;
    try {
        await s3.deleteFile({
            bucket: resolveS3Bucket(),
            objectName: objectKey,
        });
    } catch {
        // Best-effort cleanup.
    }
}

export async function generateBorrowDipPackage(input: {
    requestId: string;
    fileIds: string[];
    placementId?: string;
}): Promise<void> {
    const uniqueFileIds = [...new Set(input.fileIds.filter(Boolean))];
    if (uniqueFileIds.length === 0) {
        await db
            .update(archiveBorrowDipPackages)
            .set({
                status: ArchiveBorrowDipStatus.FAILED,
                errorMessage: "No files to include in DIP package",
                updatedAt: new Date(),
            })
            .where(eq(archiveBorrowDipPackages.requestId, input.requestId));
        return;
    }

    const files = await db.query.dossierFiles.findMany({
        where: inArray(dossierFiles.id, uniqueFileIds),
        columns: {
            id: true,
            dossierId: true,
            fileName: true,
            filePath: true,
        },
    });

    if (files.length === 0) {
        await db
            .update(archiveBorrowDipPackages)
            .set({
                status: ArchiveBorrowDipStatus.FAILED,
                errorMessage: "Borrow files not found",
                updatedAt: new Date(),
            })
            .where(eq(archiveBorrowDipPackages.requestId, input.requestId));
        return;
    }

    const dossierIds = [...new Set(files.map((f) => f.dossierId))];
    const applyWatermark = await resolveApplyWatermarkForDossiers(dossierIds);
    const watermarkConfig = await resolveWatermarkApplyConfig(
        input.placementId,
        applyWatermark,
    );

    const pdfFiles = await Promise.all(
        files.map(async (file) => ({
            fileName: file.fileName,
            data: await downloadExportPdf(file.filePath),
            fileId: file.id,
            dossierId: file.dossierId,
        })),
    );

    const watermarked = await applyWatermarkConfigToPdfFiles(
        pdfFiles.map((f) => ({ fileName: f.fileName, data: f.data })),
        watermarkConfig,
    );

    await ensureBorrowDipPrefixMarker();

    const manifest: ArchiveBorrowDipManifest = [];
    let totalBytes = 0;
    const hash = createHash("sha256");

    for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const pdf = watermarked[i] ?? { fileName: file.fileName, data: pdfFiles[i]!.data };
        const objectKey = buildBorrowDipObjectKey(
            input.requestId,
            file.id,
            pdf.fileName || file.fileName,
        );
        await uploadBorrowDipObject(objectKey, pdf.data);
        totalBytes += pdf.data.byteLength;
        hash.update(pdf.data);
        manifest.push({
            fileId: file.id,
            dossierId: file.dossierId,
            objectKey,
            fileName: pdf.fileName || file.fileName,
        } satisfies ArchiveBorrowDipManifestEntry);
        pdf.data = new Uint8Array(0);
    }

    await db
        .update(archiveBorrowDipPackages)
        .set({
            status: ArchiveBorrowDipStatus.READY,
            storageKey: `${resolveBorrowDipPrefix()}/${input.requestId}`,
            layout: ArchiveBorrowDipLayout.UNPACKED,
            manifest,
            checksum: hash.digest("hex"),
            byteSize: totalBytes,
            hasWatermark: Boolean(watermarkConfig),
            isEncrypted: false,
            generatedAt: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
        })
        .where(eq(archiveBorrowDipPackages.requestId, input.requestId));
}

export async function revokeBorrowDipPackage(requestId: string): Promise<void> {
    const pack = await db.query.archiveBorrowDipPackages.findFirst({
        where: eq(archiveBorrowDipPackages.requestId, requestId),
    });
    if (!pack || pack.status === ArchiveBorrowDipStatus.REVOKED) {
        return;
    }

    for (const entry of pack.manifest ?? []) {
        if (entry.objectKey) {
            await deleteBorrowDipObject(entry.objectKey);
        }
    }

    await db
        .update(archiveBorrowDipPackages)
        .set({
            status: ArchiveBorrowDipStatus.REVOKED,
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(archiveBorrowDipPackages.id, pack.id));
}

export { sha256HexBytes };
