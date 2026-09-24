import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { activeDossierWhere } from "../../modules/dossier/active-query-filters.ts";
import {
  downloadExportPdfSource,
  downloadJsonFromStorage,
  resolveMetadataJsonKey,
  tryDownloadBinaryFromStorage,
} from "../../modules/data-entry/data-entry-s3-utils.ts";
import {
  toExportPdfKey,
  toExportTiffKey,
} from "../../modules/dossier/dossier-path-utils.ts";
import { parseDossierMetadata } from "../metadata-normalize.ts";
import { collectMetadataPdfSources } from "../metadata-export.ts";
import { convertToPdfA } from "../pdf-a/pdf-a-converter.ts";
import { runConvertPdfToTiff } from "../cpu-worker/cpu-worker-pool.ts";
import { uploadBinaryToStorage, statStorageObject } from "../archival-storage.ts";
import { mapWithConcurrency } from "../export-concurrency.ts";

/** Limit CPU during background pregen so approve spikes stay bounded. */
const EXPORT_DERIVATIVE_FILE_CONCURRENCY = 3;

export type GenerateExportDerivativesResult = {
  dossierId: string;
  pdfUploaded: number;
  tiffUploaded: number;
  skipped: number;
  failed: number;
};

/**
 * After APPROVED: convert each dossier PDF to PDF/A-2b + TIFF and store under
 * Export/PDF and Export/TIFF (siblings of raw/). Safe to call fire-and-forget.
 */
export async function generateAndPersistExportDerivatives(input: {
  dossierId: string;
}): Promise<GenerateExportDerivativesResult> {
  const dossier = await db.query.dossiers.findFirst({
    where: activeDossierWhere(eq(dossiers.id, input.dossierId)),
    with: { files: true },
  });
  if (!dossier) {
    throw httpError.notFound("Dossier not found");
  }

  const rawKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
  if (!rawKey) {
    console.warn(
      `[ExportDerivatives] Skip dossier ${input.dossierId}: no metadata key`,
    );
    return {
      dossierId: input.dossierId,
      pdfUploaded: 0,
      tiffUploaded: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const metadataKey = resolveMetadataJsonKey(rawKey);
  const raw = await downloadJsonFromStorage(metadataKey);
  const metadata = parseDossierMetadata(raw);
  if (!metadata) {
    console.warn(
      `[ExportDerivatives] Skip dossier ${input.dossierId}: invalid metadata`,
    );
    return {
      dossierId: input.dossierId,
      pdfUploaded: 0,
      tiffUploaded: 0,
      skipped: 0,
      failed: 0,
    };
  }
  const files = (dossier.files ?? []).map((f) => ({
    id: f.id,
    fileName: f.fileName,
    filePath: f.filePath,
    signedFilePath: f.signedFilePath ?? null,
  }));
  const sources = collectMetadataPdfSources(metadata, files);

  let pdfUploaded = 0;
  let tiffUploaded = 0;
  let skipped = 0;
  let failed = 0;

  await mapWithConcurrency(
    sources,
    EXPORT_DERIVATIVE_FILE_CONCURRENCY,
    async (source) => {
      const exportPdfKey = toExportPdfKey(source.storageKey);
      const exportTiffKey = toExportTiffKey(source.storageKey);
      if (!exportPdfKey || !exportTiffKey) {
        skipped += 1;
        return;
      }

      try {
        const [pdfStat, tiffStat] = await Promise.all([
          statStorageObject(exportPdfKey),
          statStorageObject(exportTiffKey),
        ]);
        if (pdfStat.exists && tiffStat.exists) {
          skipped += 1;
          return;
        }

        let pdfBytesForDerivatives: Uint8Array | null = null;

        if (pdfStat.exists) {
          pdfBytesForDerivatives = await tryDownloadBinaryFromStorage(
            exportPdfKey,
          );
        }

        if (!pdfBytesForDerivatives) {
          const downloaded = await downloadExportPdfSource(source);
          if (!pdfStat.exists) {
            if (downloaded.preserveSignature) {
              // Keep signed PDF as-is under Export/PDF so export can still hit cache.
              await uploadBinaryToStorage(exportPdfKey, downloaded.data, {
                contentType: "application/pdf",
              });
              pdfBytesForDerivatives = downloaded.data;
            } else {
              pdfBytesForDerivatives = await convertToPdfA(downloaded.data, {
                title: metadata.ho_so_id || dossier.name,
              });
              await uploadBinaryToStorage(
                exportPdfKey,
                pdfBytesForDerivatives,
                { contentType: "application/pdf" },
              );
            }
            pdfUploaded += 1;
          } else {
            pdfBytesForDerivatives = downloaded.data;
          }
        }

        if (!tiffStat.exists && pdfBytesForDerivatives) {
          const tiffBytes = await runConvertPdfToTiff(pdfBytesForDerivatives);
          await uploadBinaryToStorage(exportTiffKey, tiffBytes, {
            contentType: "image/tiff",
          });
          tiffUploaded += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[ExportDerivatives] Failed ${source.storageKey} (dossier ${input.dossierId}):`,
          err,
        );
      }
    },
  );

  console.info(
    `[ExportDerivatives] dossier=${input.dossierId} pdf=${pdfUploaded} tiff=${tiffUploaded} skipped=${skipped} failed=${failed}`,
  );

  return {
    dossierId: input.dossierId,
    pdfUploaded,
    tiffUploaded,
    skipped,
    failed,
  };
}
