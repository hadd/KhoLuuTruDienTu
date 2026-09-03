import { buildAipHosoPackage } from "./aip-hoso-builder.ts";
import {
  buildDipExportZipStream,
  type DipZipStreamResult,
} from "./dip-hoso-builder.ts";
import { shouldSkipExistingAip } from "./aip-idempotent.ts";
import { resolveAipObjectKey, resolveHoSoId } from "./aip-path-utils.ts";
import {
  collectPackagePdfFiles,
  countPackagePdfSources,
} from "./collect-package-sources.ts";
import {
  applyWatermarkConfigToPdfFiles,
  resolveWatermarkApplyConfig,
} from "../watermark/maybe-watermark-pdf-files.ts";
import { resolveExportZipPassword } from "../../modules/profile/resolve-export-zip-password.ts";
import {
  resolveApplyWatermarkForDossiers,
} from "../../modules/security-level/security-enforcement.ts";
import { assertExportFileLimit } from "../export-file-limit.ts";
import {
  EXPORT_DOSSIER_CONCURRENCY,
  mapInBatches,
} from "../export-concurrency.ts";
import type { PackageBuildInput } from "./package-types.ts";
import {
  downloadJsonFromStorage,
  resolveMetadataJsonKey,
} from "../../modules/data-entry/data-entry-s3-utils.ts";
import { parseDossierMetadata } from "../metadata-normalize.ts";
import { httpError } from "@shared/common-lib";
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import {
  activeDossierWhere,
  activeFolderWhere,
} from "../../modules/dossier/active-query-filters.ts";
import {
  buildAipPresignedUrl,
  resolveAipBucket,
  statStorageObject,
  uploadBinaryWithObjectLock,
} from "../archival-storage.ts";

type DossierRow = {
  id: string;
  name: string;
  folderPath: string;
  status: string;
  currentMetadataKey: string | null;
  fondId: string | null;
  files?: Array<{ fileName: string; filePath: string }>;
};

type DipExportOptions = {
  placementId?: string;
  applyWatermark?: boolean;
  /** User performing the export — used for personal ZIP password. */
  userId?: string;
  /** Plaintext dossier/level access password for ZIP encrypt_download_dossier mode. */
  dossierAccessPassword?: string;
  /** Set of dossier file IDs to skip from the export (due to missing download permissions) */
  skippedFileIds?: Set<string>;
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
    throw httpError.badRequest(
      "Dossier must be approved before archival export",
    );
  }

  if (!dossier.currentMetadataKey) {
    throw httpError.badRequest("Dossier has no current metadata");
  }

  const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey);
  const rawMetadata = await downloadJsonFromStorage(metadataKey);
  const metadata = parseDossierMetadata(rawMetadata);

  if (!metadata) {
    throw httpError.badRequest(
      `Invalid metadata format for dossier "${dossier.name}"`,
    );
  }

  const hoSoId = resolveHoSoId(metadata, dossier.name, dossier.id);

  return { dossier, metadata, hoSoId };
}

export async function generateAndPersistAip(input: {
  dossierId: string;
}): Promise<void> {
  const { dossier, metadata, hoSoId } = await loadApprovedDossierContext(
    input.dossierId,
  );

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
  const packageResult = await buildAipHosoPackage({
    metadata,
    pdfFiles,
    hoSoId,
  });

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

async function loadArchivedDossierContext(dossierId: string): Promise<{
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

  if (dossier.status !== DossierStatus.ARCHIVED && dossier.status !== DossierStatus.APPROVED) {
    throw httpError.badRequest("Dossier must be archived or approved before DIP export");
  }

  if (!dossier.currentMetadataKey) {
    throw httpError.badRequest("Dossier has no current metadata");
  }

  const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey);
  const rawMetadata = await downloadJsonFromStorage(metadataKey);
  const metadata = parseDossierMetadata(rawMetadata);

  if (!metadata) {
    throw httpError.badRequest(
      `Invalid metadata format for dossier "${dossier.name}"`,
    );
  }

  const hoSoId = resolveHoSoId(metadata, dossier.name, dossier.id);

  return { dossier, metadata, hoSoId };
}

/**
 * Resolve mixed IDs (dossier or folder) into a flat list of dossier IDs.
 * For each ID: if it matches a dossier row, use it directly;
 * otherwise look up as a folder and collect all dossiers in its subtree.
 */
async function resolveIdsIntoDossierIds(ids: string[]): Promise<string[]> {
  const matchedDossiers = await db.query.dossiers.findMany({
    where: activeDossierWhere(inArray(dossiers.id, ids)),
    columns: { id: true },
  });
  const dossierIdSet = new Set(matchedDossiers.map((d) => d.id));
  const remainingIds = ids.filter((id) => !dossierIdSet.has(id));

  if (remainingIds.length === 0) {
    return [...dossierIdSet];
  }

  for (const folderId of remainingIds) {
    const rootFolder = await db.query.folders.findFirst({
      where: activeFolderWhere(eq(folders.id, folderId)),
    });
    if (!rootFolder) {
      throw httpError.notFound(`Dossier or folder not found: ${folderId}`);
    }

    const subtreeFolders = await db.query.folders.findMany({
      where: activeFolderWhere(
        or(
          eq(folders.id, folderId),
          like(folders.folderPath, `${rootFolder.folderPath}/%`),
        ),
      ),
      columns: { id: true },
    });
    const subtreeFolderIds = subtreeFolders.map((f) => f.id);

    if (subtreeFolderIds.length > 0) {
      const folderDossiers = await db.query.dossiers.findMany({
        where: activeDossierWhere(inArray(dossiers.folderId, subtreeFolderIds)),
        columns: { id: true },
      });
      for (const d of folderDossiers) {
        dossierIdSet.add(d.id);
      }
    }
  }

  if (dossierIdSet.size === 0) {
    throw httpError.badRequest("No dossiers found for the given IDs");
  }

  return [...dossierIdSet];
}

export async function exportDipHoso(
  dossierId: string,
  options?: DipExportOptions,
) {
  return await exportDipHosoBatch([dossierId], options);
}

export async function exportDipHosoBatch(
  inputIds: string[],
  options?: DipExportOptions,
): Promise<DipZipStreamResult> {
  const uniqueInputIds = [
    ...new Set(inputIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueInputIds.length === 0) {
    throw httpError.badRequest("At least one dossier or folder ID is required");
  }

  const resolvedDossierIds = await resolveIdsIntoDossierIds(uniqueInputIds);
  const applyWatermark = options?.applyWatermark === true
    ? await resolveApplyWatermarkForDossiers(resolvedDossierIds)
    : false;
  const watermarkConfig = applyWatermark
    ? await resolveWatermarkApplyConfig(
        options?.placementId,
        true,
      )
    : null;

  // Phase 1: load metadata only, count PDF sources, fail early before downloads.
  const contexts = await mapInBatches(
    resolvedDossierIds,
    EXPORT_DOSSIER_CONCURRENCY,
    async (id) => {
      const { metadata, hoSoId, dossier } =
        await loadArchivedDossierContext(id);
      
      const files = options?.skippedFileIds
        ? (dossier.files ?? []).filter(f => !options.skippedFileIds!.has(f.id))
        : (dossier.files ?? []);

      return {
        metadata,
        hoSoId,
        fondId: dossier.fondId,
        files,
        pdfCount: countPackagePdfSources(metadata, files),
      };
    },
  );
  const totalPdfFiles = contexts.reduce((sum, ctx) => sum + ctx.pdfCount, 0);
  assertExportFileLimit(totalPdfFiles);

  const zipResolved = options?.userId
    ? await resolveExportZipPassword({
        userId: options.userId,
        dossierIds: resolvedDossierIds,
        dossierAccessPassword: options.dossierAccessPassword,
      })
    : { password: undefined, source: "none" as const };
  const zipPassword = zipResolved.password;

  // Phase 2: download + watermark in bounded dossier batches.
  const packages = await mapInBatches(
    contexts,
    EXPORT_DOSSIER_CONCURRENCY,
    async (ctx) => {
      let pdfFiles = await collectPackagePdfFiles(ctx.metadata, ctx.files);
      pdfFiles = await applyWatermarkConfigToPdfFiles(
        pdfFiles,
        watermarkConfig,
      );
      return {
        metadata: ctx.metadata,
        pdfFiles,
        hoSoId: ctx.hoSoId,
      } satisfies PackageBuildInput;
    },
  );

  return await buildDipExportZipStream(packages, zipPassword).then((result) => ({
    ...result,
    zipPasswordSource: zipResolved.source,
  }));
}
