/**
 * Create new TT05 fake dossiers (no PDF required): DB record + processed JSON + READY_FOR_ENTRY.
 *
 * Usage:
 *   deno task seed:tt05-dossiers
 *   deno task seed:tt05-dossiers -- --folder-segment TESST3
 *   deno task seed:tt05-dossiers -- --project dđ --folder-segment TESST3
 *   deno task seed:tt05-dossiers -- --ho-so-ids TT05_FAKE_01 --upload-pdfs
 *   deno task seed:tt05-dossiers -- --no-upload-pdfs
 *   deno task seed:tt05-dossiers -- --ho-so-ids TT05_FAKE_01 --repair-metadata
 *   deno task seed:tt05-dossiers -- --ho-so-ids TT05_FAKE_01 --repair-assignments
 */

import { and, eq, inArray, like, sql } from "drizzle-orm";

import { closeDb, connectDb } from "../../db/db-conn.ts";
import {
  statStorageObject,
  uploadBinaryToStorage,
} from "../../libs/archival-storage.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import {
  AssignmentStatus,
  DossierStatus,
  EntityType,
  QC_CHECKER_WORKFLOW,
  WorkerRole,
  type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../../modules/dossier/active-query-filters.ts";
import { toSearchablePdfKey } from "../../modules/dossier/dossier-path-utils.ts";
import { DossierService } from "../../modules/dossier/dossier-service.ts";
import { handleOcrCallback } from "../../modules/ocr-callback/ocr-callback-service.ts";
import {
  buildDefaultPdfFiles,
  buildMinimalPdfBytes,
  loadTt05Template,
  normalizeFolderPath,
  type PdfFileRef,
} from "./tt05-fixture-builder.ts";
import { seedTt05FakeFiles } from "./seed-tt05-fake-files.ts";
import { logger } from "./utils.ts";

const DEFAULT_FOLDER_SEGMENT = "TESST3";
const DEFAULT_HO_SO_IDS = ["TT05_FAKE_01", "TT05_FAKE_02", "TT05_FAKE_03"];

type CliOptions = {
  project?: string;
  folderSegment: string;
  hoSoIds: string[];
  skipExisting: boolean;
  writeLocal: boolean;
  uploadPdfs: boolean;
  repairMetadata: boolean;
  repairAssignments: boolean;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    folderSegment: DEFAULT_FOLDER_SEGMENT,
    hoSoIds: [...DEFAULT_HO_SO_IDS],
    skipExisting: true,
    writeLocal: true,
    uploadPdfs: true,
    repairMetadata: false,
    repairAssignments: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project") options.project = args[++i]?.trim();
    else if (arg === "--folder-segment") {
      options.folderSegment = args[++i]?.trim() ?? DEFAULT_FOLDER_SEGMENT;
    } else if (arg === "--ho-so-ids") {
      const raw = args[++i] ?? "";
      options.hoSoIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
    }     else if (arg === "--force") options.skipExisting = false;
    else if (arg === "--no-write-local") options.writeLocal = false;
    else if (arg === "--upload-pdfs") options.uploadPdfs = true;
    else if (arg === "--no-upload-pdfs") options.uploadPdfs = false;
    else if (arg === "--repair-metadata") options.repairMetadata = true;
    else if (arg === "--repair-assignments") options.repairAssignments = true;
  }

  if (options.hoSoIds.length === 0) {
    throw new Error("At least one ho-so-id is required.");
  }

  return options;
}

async function resolveProjectCode(
  db: ReturnType<typeof connectDb>,
  folderSegment: string,
  explicit?: string,
): Promise<string> {
  if (explicit) return explicit;

  const parentFolderPath = normalizeFolderPath(`raw/${folderSegment}`);
  const parentFolder = await db.query.folders.findFirst({
    where: eq(folders.folderPath, parentFolderPath),
    columns: { projectCode: true },
  });
  if (parentFolder?.projectCode) {
    return parentFolder.projectCode;
  }

  const childDossier = await db
    .select({ projectCode: dossiers.projectCode })
    .from(dossiers)
    .where(activeDossierWhere(like(dossiers.folderPath, `${parentFolderPath}/%`)))
    .limit(1);

  const resolved = childDossier[0]?.projectCode ?? null;
  if (!resolved) {
    throw new Error(
      `Could not resolve project code for raw/${folderSegment}. Pass --project explicitly.`,
    );
  }

  return resolved;
}

async function findDossierByFolderPath(
  db: ReturnType<typeof connectDb>,
  folderPath: string,
) {
  return db.query.dossiers.findFirst({
    where: activeDossierWhere(
      and(
        eq(dossiers.folderPath, folderPath),
        eq(dossiers.name, folderPath.split("/").filter(Boolean).at(-1) ?? ""),
      ),
    ),
  });
}

async function countDossierFiles(
  db: ReturnType<typeof connectDb>,
  dossierId: string,
) {
  const rows = await db
    .select({ id: dossierFiles.id })
    .from(dossierFiles)
    .where(eq(dossierFiles.dossierId, dossierId));
  return rows.length;
}

/** Group assign requires at least one row in dossier_files (PDF on S3 is optional). */
async function ensureFakeDossierFiles(
  db: ReturnType<typeof connectDb>,
  dossierId: string,
  folderPath: string,
  hoSoId: string,
) {
  const existingCount = await countDossierFiles(db, dossierId);
  if (existingCount > 0) {
    return { created: 0, total: existingCount };
  }

  const template = await loadTt05Template();
  const documentCount = template.metadata_groups.find((group) =>
    group.group_code === "TAI_LIEU_LUU_TRU"
  )?.documents?.length ?? 2;
  const pdfFiles = buildDefaultPdfFiles(folderPath, hoSoId, documentCount);

  let created = 0;
  for (const file of pdfFiles) {
    const inserted = await db
      .insert(dossierFiles)
      .values({
        dossierId,
        fileName: file.fileName,
        filePath: file.filePath,
        fileSizeKb: 100,
        ocrRunMode: "auto",
      })
      .onConflictDoNothing({ target: dossierFiles.filePath })
      .returning({ id: dossierFiles.id });
    if (inserted.length > 0) created += 1;
  }

  const total = await countDossierFiles(db, dossierId);
  logger.info(`Ensured ${total} fake file record(s) for dossier ${dossierId}`);
  return { created, total };
}

async function listDossierPdfFiles(
  db: ReturnType<typeof connectDb>,
  dossierId: string,
  folderPath: string,
  hoSoId: string,
): Promise<PdfFileRef[]> {
  const rows = await db
    .select({
      fileName: dossierFiles.fileName,
      filePath: dossierFiles.filePath,
    })
    .from(dossierFiles)
    .where(eq(dossierFiles.dossierId, dossierId))
    .orderBy(dossierFiles.fileName);

  if (rows.length > 0) {
    return rows.map((row) => ({
      fileName: row.fileName,
      filePath: row.filePath,
    }));
  }

  const template = await loadTt05Template();
  const documentCount = template.metadata_groups.find((group) =>
    group.group_code === "TAI_LIEU_LUU_TRU"
  )?.documents?.length ?? 2;
  return buildDefaultPdfFiles(folderPath, hoSoId, documentCount);
}

async function uploadPlaceholderPdfs(
  pdfFiles: PdfFileRef[],
  options: { skipExisting: boolean },
) {
  let uploaded = 0;
  let skipped = 0;

  for (const file of pdfFiles) {
    const keys = [normalizeFolderPath(file.filePath)];
    const searchableKey = toSearchablePdfKey(file.filePath);
    if (searchableKey) {
      keys.push(searchableKey);
    }

    for (const key of keys) {
      if (options.skipExisting) {
        const stat = await statStorageObject(key);
        if (stat.exists) {
          skipped += 1;
          continue;
        }
      }

      await uploadBinaryToStorage(
        key,
        buildMinimalPdfBytes(file.fileName),
        { contentType: "application/pdf" },
      );
      uploaded += 1;
      logger.info(`Uploaded placeholder PDF: ${key}`);
    }
  }

  logger.info(
    `Placeholder PDFs: uploaded=${uploaded}, skipped=${skipped}, total=${pdfFiles.length}`,
  );
  return { uploaded, skipped };
}

async function ensureDossierRecord(
  db: ReturnType<typeof connectDb>,
  input: { project: string; hoSoId: string; folderPath: string },
) {
  const existing = await findDossierByFolderPath(db, input.folderPath);
  if (existing) return existing;

  const created = await DossierService.create({
    folderId: "00000000-0000-0000-0000-000000000000",
    folderPath: input.folderPath,
    name: input.hoSoId,
    entityType: EntityType.DOCUMENT,
    projectCode: input.project,
  });

  logger.info(`Created dossier ${created.id} (${input.folderPath})`);
  return created;
}

const CHECKER_ROLES = QC_CHECKER_WORKFLOW.map((config) => config.role) as [
  WorkerRoleType,
  WorkerRoleType,
  ...WorkerRoleType[],
];

/** Reset COMPLETED maker/checker rows so editors can claim again after metadata repair. */
async function repairDossierEditorAssignments(
  db: ReturnType<typeof connectDb>,
  dossierId: string,
) {
  const now = new Date();

  const makerReset = await db
    .update(dossierAssignments)
    .set({
      status: AssignmentStatus.IN_PROGRESS,
      completedAt: null,
      metadataKey: null,
      rejectFields: null,
      attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
      assignedAt: now,
    })
    .where(and(
      eq(dossierAssignments.dossierId, dossierId),
      eq(dossierAssignments.role, WorkerRole.MAKER),
      eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
    ))
    .returning({ id: dossierAssignments.id, role: dossierAssignments.role });

  const checkerReset = await db
    .update(dossierAssignments)
    .set({
      status: AssignmentStatus.IN_PROGRESS,
      completedAt: null,
      metadataKey: null,
      attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
      assignedAt: now,
    })
    .where(and(
      eq(dossierAssignments.dossierId, dossierId),
      inArray(dossierAssignments.role, CHECKER_ROLES),
      eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
    ))
    .returning({ id: dossierAssignments.id, role: dossierAssignments.role });

  await db
    .update(dossiers)
    .set({
      status: DossierStatus.READY_FOR_ENTRY,
      currentQcStep: 0,
      lastRejectNotes: null,
      updatedAt: now,
    })
    .where(eq(dossiers.id, dossierId));

  logger.info(
    `Repaired assignments for dossier ${dossierId}: makers=${makerReset.length}, checkers=${checkerReset.length}`,
  );

  return {
    makersReset: makerReset.length,
    checkersReset: checkerReset.length,
  };
}

export async function seedTt05FakeDossiers(options: CliOptions) {
  const db = connectDb();
  const projectCode = await resolveProjectCode(
    db,
    options.folderSegment,
    options.project,
  );
  logger.info(`Using projectCode="${projectCode}" under raw/${options.folderSegment}`);

  const results: Array<{
    hoSoId: string;
    folderPath: string;
    dossierId: string;
    processedKey: string;
    status: string;
    skipped: boolean;
  }> = [];

  for (const hoSoId of options.hoSoIds) {
    const folderPath = normalizeFolderPath(`raw/${options.folderSegment}/${hoSoId}`);
    logger.info(`--- Seeding ${folderPath} ---`);

    if (options.repairAssignments) {
      const existing = await findDossierByFolderPath(db, folderPath);
      if (!existing) {
        throw new Error(
          `Cannot repair assignments: dossier not found for ${folderPath}.`,
        );
      }

      const repaired = await repairDossierEditorAssignments(db, existing.id);
      logger.info(
        `Repaired assignments ${hoSoId}: dossierId=${existing.id}, makers=${repaired.makersReset}, checkers=${repaired.checkersReset}`,
      );

      results.push({
        hoSoId,
        folderPath,
        dossierId: existing.id,
        processedKey: existing.ocrMetadataKey ?? "",
        status: DossierStatus.READY_FOR_ENTRY,
        skipped: false,
      });
      continue;
    }

    if (options.repairMetadata) {
      const existing = await findDossierByFolderPath(db, folderPath);
      if (!existing) {
        throw new Error(
          `Cannot repair metadata: dossier not found for ${folderPath}. Create it first or omit --repair-metadata.`,
        );
      }

      const seeded = await seedTt05FakeFiles({
        folderPath,
        hoSoId,
        writeLocal: options.writeLocal,
        upload: true,
        syncDb: false,
      });

      await db
        .update(dossiers)
        .set({
          ocrMetadataKey: null,
          currentMetadataKey: null,
          updatedAt: new Date(),
        })
        .where(eq(dossiers.id, existing.id));

      const callback = await handleOcrCallback({
        ho_so_id: hoSoId,
        output_path: seeded.processedKey,
      });

      logger.info(
        `Repaired metadata ${hoSoId}: dossierId=${callback.dossierId}, status=${callback.status}`,
      );

      results.push({
        hoSoId,
        folderPath,
        dossierId: callback.dossierId,
        processedKey: callback.ocrMetadataKey,
        status: callback.status,
        skipped: false,
      });
      continue;
    }

    const existing = await findDossierByFolderPath(db, folderPath);
    const existingFileCount = existing
      ? await countDossierFiles(db, existing.id)
      : 0;

    if (
      options.skipExisting &&
      existing?.ocrMetadataKey &&
      existing.status === "READY_FOR_ENTRY" &&
      existingFileCount > 0
    ) {
      if (options.uploadPdfs && existing) {
        const pdfFiles = await listDossierPdfFiles(
          db,
          existing.id,
          folderPath,
          hoSoId,
        );
        await uploadPlaceholderPdfs(pdfFiles, { skipExisting: true });
      }
      logger.info(`Skipped ${hoSoId}: already READY_FOR_ENTRY with metadata and files.`);
      results.push({
        hoSoId,
        folderPath,
        dossierId: existing.id,
        processedKey: existing.ocrMetadataKey,
        status: existing.status,
        skipped: true,
      });
      continue;
    }

    const dossier = await ensureDossierRecord(db, {
      project: projectCode,
      hoSoId,
      folderPath,
    });

    await ensureFakeDossierFiles(db, dossier.id, folderPath, hoSoId);

    if (options.uploadPdfs) {
      const pdfFiles = await listDossierPdfFiles(
        db,
        dossier.id,
        folderPath,
        hoSoId,
      );
      await uploadPlaceholderPdfs(pdfFiles, { skipExisting: true });
    }

    if (
      options.skipExisting &&
      dossier.ocrMetadataKey &&
      dossier.status === "READY_FOR_ENTRY"
    ) {
      logger.info(`Repaired ${hoSoId}: added missing dossier file records.`);
      results.push({
        hoSoId,
        folderPath,
        dossierId: dossier.id,
        processedKey: dossier.ocrMetadataKey,
        status: dossier.status,
        skipped: true,
      });
      continue;
    }

    const seeded = await seedTt05FakeFiles({
      folderPath,
      hoSoId,
      writeLocal: options.writeLocal,
      upload: true,
      syncDb: false,
    });

    const callback = await handleOcrCallback({
      ho_so_id: hoSoId,
      output_path: seeded.processedKey,
    });

    logger.info(
      `Done ${hoSoId}: dossierId=${callback.dossierId}, status=${callback.status}`,
    );

    results.push({
      hoSoId,
      folderPath,
      dossierId: callback.dossierId,
      processedKey: callback.ocrMetadataKey,
      status: callback.status,
      skipped: false,
    });
  }

  logger.info("TT05 fake dossiers summary:");
  for (const item of results) {
    logger.info(
      `- ${item.hoSoId}: ${item.skipped ? "skipped" : "seeded"} | ${item.status} | ${item.processedKey}`,
    );
  }

  return results;
}

if (import.meta.main) {
  try {
    await seedTt05FakeDossiers(parseArgs(Deno.args));
  } finally {
    await closeDb();
  }
}
