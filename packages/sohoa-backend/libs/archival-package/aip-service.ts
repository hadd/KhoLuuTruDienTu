import { httpError } from "@shared/common-lib";
import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../../modules/dossier/active-query-filters.ts";
import {
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
} from "../../modules/data-entry/data-entry-s3-utils.ts";
import { isDossierMetadata } from "../metadata-types.ts";
import {
    buildAipPresignedUrl,
    resolveAipBucket,
    statStorageObject,
    uploadBinaryWithObjectLock,
} from "../archival-storage.ts";
import { buildAipHosoPackage } from "./aip-hoso-builder.ts";
import { buildDipHosoPackage } from "./dip-hoso-builder.ts";
import { shouldSkipExistingAip } from "./aip-idempotent.ts";
import { resolveAipObjectKey, resolveHoSoId } from "./aip-path-utils.ts";
import { collectPackagePdfFiles } from "./collect-package-sources.ts";

type DossierRow = {
    id: string;
    name: string;
    folderPath: string;
    status: string;
    currentMetadataKey: string | null;
    files?: Array<{ fileName: string; filePath: string }>;
};

async function loadApprovedDossierContext(dossierId: string): Promise<{
    dossier: DossierRow;
    metadata: import("../metadata-types.ts").DossierMetadata;
    hoSoId: string;
}> {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        with: { files: true },
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    if (dossier.status !== DossierStatus.APPROVED) {
        throw httpError.badRequest("Dossier must be approved before archival export");
    }

    if (!dossier.currentMetadataKey) {
        throw httpError.badRequest("Dossier has no current metadata");
    }

    const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey);
    const rawMetadata = await downloadJsonFromStorage(metadataKey);

    if (!isDossierMetadata(rawMetadata)) {
        throw httpError.badRequest(`Invalid metadata format for dossier "${dossier.name}"`);
    }

    const hoSoId = resolveHoSoId(rawMetadata, dossier.name, dossier.id);

    return { dossier, metadata: rawMetadata, hoSoId };
}

export async function generateAndPersistAip(input: { dossierId: string }): Promise<void> {
    const { dossier, metadata, hoSoId } = await loadApprovedDossierContext(input.dossierId);

    const aipKey = resolveAipObjectKey({
        folderPath: dossier.folderPath,
        metadata,
        dossierName: dossier.name,
        dossierId: dossier.id,
    });

    const bucket = resolveAipBucket();
    const existing = await statStorageObject(aipKey, bucket);
    if (shouldSkipExistingAip(existing)) {
        return;
    }

    const pdfFiles = await collectPackagePdfFiles(metadata, dossier.files ?? []);
    const packageResult = await buildAipHosoPackage({ metadata, pdfFiles, hoSoId });

    await uploadBinaryWithObjectLock(aipKey, packageResult.buffer, {
        bucket,
        contentType: "application/zip",
        metadata: {
            "package-type": "AIP_hoso",
            "ho-so-id": hoSoId,
            "dossier-id": dossier.id,
        },
    });
}

export async function getAipStatus(dossierId: string) {
    const { dossier, metadata } = await loadApprovedDossierContext(dossierId);

    const aipKey = resolveAipObjectKey({
        folderPath: dossier.folderPath,
        metadata,
        dossierName: dossier.name,
        dossierId: dossier.id,
    });

    const bucket = resolveAipBucket();
    const stat = await statStorageObject(aipKey, bucket);
    const presignedUrl = stat.exists ? await buildAipPresignedUrl(aipKey) : null;

    return {
        dossierId,
        aipKey,
        bucket,
        exists: stat.exists,
        size: stat.size,
        lastModified: stat.lastModified?.toISOString() ?? null,
        presignedUrl,
    };
}

export async function exportDipHoso(dossierId: string) {
    const { metadata, hoSoId, dossier } = await loadApprovedDossierContext(dossierId);
    const pdfFiles = await collectPackagePdfFiles(metadata, dossier.files ?? []);
    const packageResult = await buildDipHosoPackage({ metadata, pdfFiles, hoSoId });

    return {
        buffer: packageResult.buffer,
        filename: packageResult.filename,
        contentType: "application/zip" as const,
    };
}
