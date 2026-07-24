/**
 * Upload fake TT05 processed metadata to S3 and point a dossier at it.
 *
 * Usage:
 *   deno task seed:tt05-metadata -- --folder-path raw/TESST10/296_CD
 *   deno task seed:tt05-metadata -- --dossier-id <uuid>
 *   deno task seed:tt05-metadata -- --ho-so-id 296_CD
 *
 * For local fixture files + upload, prefer: deno task seed:tt05-fake
 */

import { and, eq, like } from "drizzle-orm";
import { activeDossierWhere } from "../../modules/dossier/active-query-filters.ts";
import { closeDb, connectDb } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { uploadJsonToStorage } from "../../modules/data-entry/data-entry-s3-utils.ts";
import {
  customizeTt05Metadata,
  loadTt05Template,
  normalizeFolderPath,
  resolveProcessedMetadataKey,
} from "./tt05-fixture-builder.ts";
import { logger } from "./utils.ts";

type CliOptions = {
  dossierId?: string;
  folderPath?: string;
  hoSoId?: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dossier-id") options.dossierId = args[++i];
    else if (arg === "--folder-path") options.folderPath = args[++i];
    else if (arg === "--ho-so-id") options.hoSoId = args[++i];
  }
  return options;
}

async function resolveDossier(
  db: ReturnType<typeof connectDb>,
  options: CliOptions,
) {
  if (options.dossierId) {
    return db.query.dossiers.findFirst({
      where: activeDossierWhere(eq(dossiers.id, options.dossierId)),
    });
  }

  if (options.folderPath) {
    const folderPath = normalizeFolderPath(options.folderPath);
    return db.query.dossiers.findFirst({
      where: activeDossierWhere(eq(dossiers.folderPath, folderPath)),
    });
  }

  if (options.hoSoId) {
    return db.query.dossiers.findFirst({
      where: activeDossierWhere(
        and(
          eq(dossiers.name, options.hoSoId),
          like(dossiers.folderPath, `%/${options.hoSoId}`),
        ),
      ),
    });
  }

  return null;
}

export async function seedTt05ProcessedMetadata(options: CliOptions) {
  const db = connectDb();
  const dossier = await resolveDossier(db, options);

  if (!dossier) {
    throw new Error(
      "Dossier not found. Pass --folder-path raw/.../296_CD, --dossier-id, or --ho-so-id.",
    );
  }

  const folderPath = normalizeFolderPath(dossier.folderPath);
  const hoSoId = options.hoSoId?.trim() || dossier.name.trim();
  const processedKey = resolveProcessedMetadataKey(folderPath);

  const files = await db
    .select({
      fileName: dossierFiles.fileName,
      filePath: dossierFiles.filePath,
    })
    .from(dossierFiles)
    .where(eq(dossierFiles.dossierId, dossier.id))
    .orderBy(dossierFiles.fileName);

  const template = await loadTt05Template();
  const metadata = customizeTt05Metadata(template, {
    hoSoId,
    folderPath,
    pdfFiles: files,
  });

  logger.info(`Uploading TT05 metadata to ${processedKey}...`);
  const storedKey = await uploadJsonToStorage(processedKey, metadata);

  await db
    .update(dossiers)
    .set({
      ocrMetadataKey: storedKey,
      currentMetadataKey: storedKey,
      updatedAt: new Date(),
    })
    .where(eq(dossiers.id, dossier.id));

  logger.info("TT05 processed metadata seeded:");
  logger.info(`- dossierId: ${dossier.id}`);
  logger.info(`- folderPath: ${folderPath}`);
  logger.info(`- ho_so_id: ${hoSoId}`);
  logger.info(`- metadataKey: ${storedKey}`);
  logger.info(`- pdf files linked: ${files.length}`);
  logger.info("Reload the dossier in Quản lý dữ liệu to see HO_SO + TAI_LIEU sections.");

  return { dossierId: dossier.id, metadataKey: storedKey };
}

if (import.meta.main) {
  try {
    await seedTt05ProcessedMetadata(parseArgs(Deno.args));
  } finally {
    await closeDb();
  }
}
