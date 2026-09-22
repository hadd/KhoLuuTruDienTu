import { AppError, httpError } from "@shared/common-lib";

function resolveMetadataJsonKey(rawKey: string): string {
  return rawKey.endsWith(".json") ? rawKey : `${rawKey}.json`;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof AppError && error.status === 404;
}

function metadataNotFoundMessage(dossierName: string, key: string): string {
  return `Metadata file not found on storage for dossier "${dossierName}" (key: ${key})`;
}

export type DownloadJsonFn = (objectKey: string) => Promise<unknown>;

/**
 * Load dossier metadata JSON for export/read.
 * Prefer currentMetadataKey; on storage 404 fall back to ocrMetadataKey.
 */
export async function loadDossierMetadataJsonFromStorage(
  input: {
    dossierName: string;
    currentMetadataKey: string | null | undefined;
    ocrMetadataKey?: string | null;
  },
  downloadJson: DownloadJsonFn,
): Promise<unknown> {
  const currentRaw = input.currentMetadataKey?.trim() || null;
  const ocrRaw = input.ocrMetadataKey?.trim() || null;
  const currentKey = currentRaw ? resolveMetadataJsonKey(currentRaw) : null;
  const ocrKey = ocrRaw ? resolveMetadataJsonKey(ocrRaw) : null;

  if (currentKey) {
    try {
      return await downloadJson(currentKey);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      if (ocrKey && ocrKey !== currentKey) {
        console.warn(
          `[MetadataExport] currentMetadataKey missing for dossier "${input.dossierName}" (${currentKey}); falling back to ocrMetadataKey (${ocrKey})`,
        );
        try {
          return await downloadJson(ocrKey);
        } catch (ocrError) {
          if (isNotFoundError(ocrError)) {
            throw httpError.notFound(
              metadataNotFoundMessage(input.dossierName, currentKey),
            );
          }
          throw ocrError;
        }
      }
      throw httpError.notFound(
        metadataNotFoundMessage(input.dossierName, currentKey),
      );
    }
  }

  if (ocrKey) {
    try {
      return await downloadJson(ocrKey);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw httpError.notFound(
          metadataNotFoundMessage(input.dossierName, ocrKey),
        );
      }
      throw error;
    }
  }

  throw httpError.notFound(
    metadataNotFoundMessage(input.dossierName, "none"),
  );
}
