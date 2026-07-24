/**
 * Generate fake TT05 metadata JSON (from assets/TT05.json) for testing UI.
 *
 * Writes a local mirror under assets/fixtures/tt05/ and optionally uploads
 * to S3 processed/ + updates dossier keys in DB.
 *
 * Usage:
 *   deno task seed:tt05-fake -- --ho-so-id 296_CD
 *   deno task seed:tt05-fake -- --folder-path raw/TESST3/296_CD --upload --sync-db
 *   deno task seed:tt05-fake -- --ho-so-id TT05_DEMO --folder-path raw/TESST3/TT05_DEMO --write-local
 */

import { and, eq, like } from "drizzle-orm";
import { activeDossierWhere } from "../../modules/dossier/active-query-filters.ts";
import { closeDb, connectDb } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { uploadJsonToStorage } from "../../modules/data-entry/data-entry-s3-utils.ts";
import {
  buildDefaultPdfFiles,
  customizeTt05Metadata,
  loadTt05Template,
  normalizeFolderPath,
  writeTt05FixtureToLocal,
} from "./tt05-fixture-builder.ts";
import { logger } from "./utils.ts";

const DEFAULT_OUTPUT_DIR = new URL(
  "../../assets/fixtures/tt05",
  import.meta.url,
);

type CliOptions = {
  dossierId?: string;
  folderPath?: string;
  hoSoId?: string;
  outputDir?: string;
  writeLocal: boolean;
  upload: boolean;
  syncDb: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    writeLocal: true,
    upload: false,
    syncDb: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dossier-id") options.dossierId = args[++i];
    else if (arg === "--folder-path") options.folderPath = args[++i];
    else if (arg === "--ho-so-id") options.hoSoId = args[++i];
    else if (arg === "--output-dir") options.outputDir = args[++i];
    else if (arg === "--write-local") options.writeLocal = true;
    else if (arg === "--no-write-local") options.writeLocal = false;
    else if (arg === "--upload") options.upload = true;
    else if (arg === "--sync-db") options.syncDb = true;
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

function resolveOutputDir(options: CliOptions): string {
  if (options.outputDir) {
    return normalizeFolderPath(options.outputDir);
  }
  return DEFAULT_OUTPUT_DIR.pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

export async function seedTt05FakeFiles(options: CliOptions) {
  const db = connectDb();
  const dossier = await resolveDossier(db, options);

  const folderPath = normalizeFolderPath(
    options.folderPath ?? dossier?.folderPath ?? "",
  );
  if (!folderPath.startsWith("raw/")) {
    throw new Error(
      "folder-path must start with raw/, e.g. raw/TESST3/296_CD. Pass --folder-path or use an existing dossier.",
    );
  }

  const hoSoId = options.hoSoId?.trim() ||
    dossier?.name.trim() ||
    folderPath.split("/").filter(Boolean).at(-1);
  if (!hoSoId) {
    throw new Error("Could not resolve ho_so_id. Pass --ho-so-id.");
  }

  const files = dossier
    ? await db
      .select({
        fileName: dossierFiles.fileName,
        filePath: dossierFiles.filePath,
      })
      .from(dossierFiles)
      .where(eq(dossierFiles.dossierId, dossier.id))
      .orderBy(dossierFiles.fileName)
    : [];

  const template = await loadTt05Template();
  const documentCount = template.metadata_groups.find((group) =>
    group.group_code === "TAI_LIEU_LUU_TRU"
  )?.documents?.length ?? 2;

  const pdfFiles = files.length > 0
    ? files.map((file) => ({
      fileName: file.fileName,
      filePath: file.filePath,
    }))
    : buildDefaultPdfFiles(folderPath, hoSoId, documentCount);

  const metadata = customizeTt05Metadata(template, {
    hoSoId,
    folderPath,
    pdfFiles,
  });

  const outputDir = resolveOutputDir(options);
  let processedKey = "";
  let localPath = "";

  if (options.writeLocal) {
    const written = await writeTt05FixtureToLocal(metadata, {
      folderPath,
      outputDir,
    });
    processedKey = written.processedKey;
    localPath = written.localPath;
    logger.info(`Wrote local fixture: ${localPath}`);
  } else {
    processedKey = `processed/${
      folderPath.replace(/^raw\//, "")
    }/${hoSoId}.json`;
  }

  if (options.upload) {
    logger.info(`Uploading TT05 metadata to ${processedKey}...`);
    processedKey = await uploadJsonToStorage(processedKey, metadata);
    logger.info(`Uploaded: ${processedKey}`);
  }

  if (options.syncDb) {
    if (!dossier) {
      throw new Error(
        "--sync-db requires an existing dossier. Pass --dossier-id, --folder-path, or --ho-so-id.",
      );
    }
    await db
      .update(dossiers)
      .set({
        ocrMetadataKey: processedKey,
        currentMetadataKey: processedKey,
        updatedAt: new Date(),
      })
      .where(eq(dossiers.id, dossier.id));
    logger.info(`Updated dossier ${dossier.id} metadata keys.`);
  }

  logger.info("TT05 fake files ready:");
  logger.info(`- folderPath: ${folderPath}`);
  logger.info(`- ho_so_id: ${hoSoId}`);
  logger.info(`- processedKey: ${processedKey}`);
  if (localPath) logger.info(`- localPath: ${localPath}`);
  logger.info(`- pdf files linked: ${pdfFiles.length}`);
  logger.info(
    "Reload the dossier in Quản lý dữ liệu to see HO_SO + TAI_LIEU sections.",
  );

  return { dossierId: dossier?.id, processedKey, localPath };
}

if (import.meta.main) {
  const options = parseArgs(Deno.args);
  if (options.upload && !options.syncDb && options.hoSoId) {
    options.syncDb = true;
  }

  try {
    await seedTt05FakeFiles(options);
  } finally {
    await closeDb();
  }
}
