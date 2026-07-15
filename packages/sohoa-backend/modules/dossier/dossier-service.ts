import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, asc, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    QC_CHECKER_WORKFLOW,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    WorkQuality,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { scheduleDossierAssignedNotification } from "../notification/notification-delivery-service.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    folderNameFromPath,
    getRawStoragePrefix,
    isRawStoragePath,
    normalizeStorageKey,
    splitFolderSegments,
    storageBasename,
    storageDirname,
    toSearchablePdfKey,
} from "./dossier-path-utils.ts";
import { buildFileFullPath } from "./dossier-s3-utils.ts";
import {
    activeDossierWhere,
    activeFolderWhere,
    isActiveDossier,
} from "./active-query-filters.ts";
import {
    collectDossierStorageKeys,
    deleteOrphanFoldersAfterDossier,
    hardDeleteFoldersByIds,
    purgeDossierFromMinIO,
    softDeleteFoldersByIds,
    softDeleteOrphanFoldersAfterDossier,
    sortFoldersDeepestFirst,
} from "./dossier-delete-utils.ts";
import {
    cancelInProgressAssignmentsForReassign,
    getCurrentAttemptNumber,
    hasInProgressAssignment,
    reopenRejectedCheckerAssignment,
    resetDossierEntryStatusAfterMakerReassign,
} from "../../libs/workflow-assignment-utils.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    getMakerAssignmentBlockReason,
    hasCompletedMakerOnDossier,
} from "../group/group-assignment-guards.ts";
import {
    findWorkableEditorAssignment,
    resolveDossierDraftKey,
    resolveMetadataKeyForDossierEditor,
} from "../data-entry/metadata-draft-service.ts";
import { executeFolderAssignmentRevoke } from "./folder-assignment-revoke.ts";
import { bulkSubmitDraftMetadata } from "../data-entry/metadata-bulk-submit-service.ts";
import {
    buildEditorMergedMetadataKey,
    buildLinkGet,
    downloadBinaryFromStorage,
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
    uploadJsonToStorage,
} from "../data-entry/data-entry-s3-utils.ts";
import {
    deleteDossierDraftMetadata,
    saveMetadataDraft as persistMetadataDraft,
} from "../data-entry/metadata-draft-service.ts";
import { recordSnapshot } from "../metadata-history/metadata-history-service.ts";
import { IssueReportService } from "../issue-report/issue-report-service.ts";
import type { IssueReportResponse } from "../issue-report/types.ts";
import {
    generateAndPersistAip,
    exportDipHoso as buildDipHosoExport,
    getAipStatus as queryAipStatus,
} from "../../libs/archival-package/aip-service.ts";
import {
    applyWatermarkConfigToPdfFiles,
    maybeWatermarkPdfFiles,
    resolveWatermarkApplyConfig,
} from "../../libs/watermark/maybe-watermark-pdf-files.ts";
import { metadataHistory } from "../../db/schemas/metadata-history.ts";
import { purgeLinkedMetadataByDossierIds } from "./dossier-delete-utils.ts";
import { buildDynamicMetadataExcel } from "../../libs/metadata-excel-export.ts";
import {
    buildUnionExportFieldCatalog,
} from "../../libs/metadata-export-field-resolver.ts";
import type { MetadataExportConfig } from "../../libs/metadata-export-types.ts";
import { buildMetadataExportPreview } from "../../libs/metadata-export-preview.ts";
import { MetadataExportPresetService } from "../metadata-export-preset/metadata-export-preset-service.ts";
import {
    buildFolderMetadataExportZip,
    buildMetadataExportZip,
    collectMetadataPdfSources,
    type DossierMetadataExportBundle,
} from "../../libs/metadata-export.ts";
import { isDossierMetadata, type DossierMetadata } from "../../libs/metadata-types.ts";
import {
    mergePartialMetadata,
    parseAllowedFields,
    validateWritePermission,
} from "../../libs/metadata-field-filter.ts";
import {
    assignByFolderIdBodySchema,
    assignDossierBodySchema,
    createDossierSchema,
    createDocumentFromStorageBodySchema,
    createUploadPointBodySchema,
    dossierEntitySchema,
    listAssignmentsByRoleQuerySchema,
    updateDossierSchema,
} from "./types.ts";
import { ProjectService } from "../project/project-service.ts";
import { assertNoMixedStorageFolderLayoutOnAdd } from "./storage-folder-layout.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StorageStatFn = (key: string) => Promise<{ fileSizeKb: number | null }>;

let storageStatOverride: StorageStatFn | null = null;

export function setStorageStatOverrideForTests(fn: StorageStatFn | null) {
    storageStatOverride = fn;
}

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

const crud = createCrudService({
    db,
    table: dossiers,
    searchable: ["name", "folderPath"],
    entitySchema: dossierEntitySchema,
    createSchema: createDossierSchema,
    updateSchema: updateDossierSchema,
    defaultWith: {
        folder: true,
        files: true,
    },
    metadata: {
        tags: ["Dossier"],
        descriptions: {
            list: "List dossiers with pagination, filtering and search.",
            get: "Get a dossier by ID with folder and files.",
            create: "Create a dossier record.",
            update: "Update a dossier record.",
            delete: "Delete a dossier record.",
        },
    },
});

async function findFolderByPath(tx: DbTx, folderPath: string) {
    return await tx.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.folderPath, folderPath)),
    });
}

function isSharedRawRootSegment(segmentPath: string): boolean {
    return segmentPath === getRawStoragePrefix();
}

/** The storage raw/ root is a shared container and must never carry a projectCode. */
function resolveFolderSegmentProjectCode(
    segmentPath: string,
    projectCode: string | null,
): string | null {
    if (isSharedRawRootSegment(segmentPath)) {
        return null;
    }
    return projectCode;
}

async function reconcileFolderProjectCode(
    tx: DbTx,
    existing: { id: string; projectCode: string | null },
    segmentPath: string,
    projectCode: string | null,
) {
    if (isSharedRawRootSegment(segmentPath)) {
        if (existing.projectCode !== null) {
            await tx
                .update(folders)
                .set({ projectCode: null, updatedAt: new Date() })
                .where(eq(folders.id, existing.id));
        }
        return;
    }

    if (projectCode === null) {
        return;
    }

    if (existing.projectCode === null) {
        await tx
            .update(folders)
            .set({ projectCode, updatedAt: new Date() })
            .where(eq(folders.id, existing.id));
        return;
    }

    if (existing.projectCode !== projectCode) {
        throw httpError.conflict(
            `Folder ${segmentPath} belongs to project ${existing.projectCode}, not ${projectCode}`,
        );
    }
}

async function ensureFolderTree(
    tx: DbTx,
    folderPath: string,
    projectCode: string | null,
): Promise<string> {
    const segments = splitFolderSegments(folderPath);
    let parentId: string | null = null;

    for (const segmentPath of segments) {
        const segmentProjectCode = resolveFolderSegmentProjectCode(
            segmentPath,
            projectCode,
        );
        const result: { id: string }[] = await tx
            .insert(folders)
            .values({
                parentId,
                folderPath: segmentPath,
                folderName: folderNameFromPath(segmentPath),
                projectCode: segmentProjectCode,
            })
            .onConflictDoNothing({
                target: folders.folderPath,
                where: isNull(folders.deletedAt),
            })
            .returning({ id: folders.id });

        const inserted = result[0];

        if (inserted) {
            parentId = inserted.id;
            continue;
        }

        const existing = await findFolderByPath(tx, segmentPath);
        if (!existing) {
            throw httpError.internal("Failed to resolve folder after conflict");
        }

        await reconcileFolderProjectCode(
            tx,
            existing,
            segmentPath,
            segmentProjectCode,
        );
        parentId = existing.id;
    }

    if (!parentId) {
        throw httpError.internal("Failed to resolve leaf folder");
    }

    return parentId;
}

async function findOrCreateDossier(
    tx: DbTx,
    folderId: string,
    folderPath: string,
    name: string,
    projectCode: string | null,
) {
    const [inserted] = await tx
        .insert(dossiers)
        .values({
            folderId,
            folderPath,
            name,
            projectCode,
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.NEW,
            requiredQcCount: 0,
        })
        .onConflictDoNothing({
            target: [dossiers.folderPath, dossiers.name],
            where: isNull(dossiers.deletedAt),
        })
        .returning();

    if (inserted) {
        return inserted;
    }

    const existing = await tx.query.dossiers.findFirst({
        where: activeDossierWhere(
            eq(dossiers.folderPath, folderPath),
            eq(dossiers.name, name),
        ),
    });

    if (!existing) {
        throw httpError.internal("Failed to resolve dossier after conflict");
    }

    if (projectCode === null) {
        return existing;
    }

    if (existing.projectCode === null) {
        const [updated] = await tx
            .update(dossiers)
            .set({ projectCode, updatedAt: new Date() })
            .where(eq(dossiers.id, existing.id))
            .returning();

        return updated ?? existing;
    }

    if (existing.projectCode !== projectCode) {
        throw httpError.conflict(
            `Dossier ${name} belongs to project ${existing.projectCode}, not ${projectCode}`,
        );
    }

    return existing;
}

async function insertDossierFile(
    tx: DbTx,
    dossierId: string,
    fileName: string,
    filePath: string,
    fileSizeKb: number | null,
) {
    const [inserted] = await tx
        .insert(dossierFiles)
        .values({
            dossierId,
            fileName,
            filePath,
            fileSizeKb,
        })
        .onConflictDoNothing({ target: dossierFiles.filePath })
        .returning();

    if (inserted) {
        return { file: inserted, created: true };
    }

    const existing = await tx.query.dossierFiles.findFirst({
        where: eq(dossierFiles.filePath, filePath),
    });

    if (!existing) {
        throw httpError.internal("Failed to resolve dossier file after conflict");
    }

    return { file: existing, created: false };
}

async function statStorageObject(key: string) {
    if (storageStatOverride) {
        return await storageStatOverride(key);
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();

    try {
        const stat = await s3.getMinIOClient().statObject(bucket, key);
        const fileSizeKb = stat.size > 0 ? Math.ceil(stat.size / 1024) : null;
        return { fileSizeKb };
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            throw httpError.notFound("File not found on storage");
        }
        throw error;
    }
}

async function ensureAssigneeExists(assigneeId: string) {
    const assignee = await db.query.userProfiles.findFirst({
        where: and(
            eq(userProfiles.id, assigneeId),
            isNull(userProfiles.deletedAt),
        ),
    });

    if (!assignee) {
        throw httpError.notFound("Assignee not found");
    }

    if (!assignee.active) {
        throw httpError.badRequest("Assignee is inactive");
    }

    return assignee;
}

async function assertNoAssignmentConflict(
    tx: DbTx,
    input: {
        dossierId: string;
        assigneeId: string;
        role: WorkerRoleType;
    },
) {
    if (input.role === WorkerRole.MAKER) {
        const sameAssignee = await tx.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.assigneeId, input.assigneeId),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { id: true },
        });
        if (sameAssignee) {
            throw httpError.conflict(
                "Assignee already has an active MAKER assignment for this dossier",
            );
        }
        return;
    }

    const sameRole = await tx.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, input.role),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { id: true },
    });
    if (sameRole) {
        throw httpError.conflict(
            `Dossier already has an active ${input.role} assignment`,
        );
    }
}

async function createDossierAssignmentInTx(
    tx: DbTx,
    input: {
        dossierId: string;
        assigneeId: string;
        role: WorkerRoleType;
        actorId: string;
        dossierStatus: string;
        stepNumber?: number;
        allowedFields?: string | null;
    },
) {
    await assertNoAssignmentConflict(tx, {
        dossierId: input.dossierId,
        assigneeId: input.assigneeId,
        role: input.role,
    });

    const attemptNumber = await getCurrentAttemptNumber(tx, input.dossierId, input.role);

    const [assignment] = await tx
        .insert(dossierAssignments)
        .values({
            dossierId: input.dossierId,
            role: input.role,
            assigneeId: input.assigneeId,
            attemptNumber,
            stepNumber: input.stepNumber ?? 1,
            status: AssignmentStatus.IN_PROGRESS,
            allowedFields: input.allowedFields ?? null,
        })
        .returning();

    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: `ASSIGN_${input.role}`,
        fromStatus: input.dossierStatus,
        toStatus: input.dossierStatus,
        notes: `Assigned to ${input.assigneeId}`,
    });

    return assignment;
}

async function assignDossierToUser(input: {
    dossierId: string;
    assigneeId: string;
    role: WorkerRoleType;
    actorId: string;
}) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, input.dossierId)),
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    await ensureAssigneeExists(input.assigneeId);

    const [activeMakers, completedMakers] = await Promise.all([
        db.query.dossierAssignments.findMany({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
    ]);
    const activeMakerIndex = buildActiveMakerIndex(activeMakers);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakers);

    if (input.role === WorkerRole.MAKER) {
        const blockReason = getMakerAssignmentBlockReason({
            dossierStatus: dossier.status,
            dossierId: input.dossierId,
            activeMakerIndex,
            completedMakerIndex,
        });
        if (blockReason) {
            throw httpError.conflict(blockReason);
        }
        if (hasCompletedMakerOnDossier(completedMakerIndex, input.dossierId)) {
            throw httpError.conflict(
                "Cannot re-assign: a maker has already submitted entry",
            );
        }

        const sameAssignee = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.assigneeId, input.assigneeId),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { id: true },
        });
        if (sameAssignee) {
            throw httpError.conflict(
                "Assignee already has an active MAKER assignment for this dossier",
            );
        }
    } else {
        const completedRole = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, input.role),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: { id: true },
        });
        if (completedRole) {
            throw httpError.conflict(
                `Dossier already has a completed ${input.role} assignment`,
            );
        }

        const sameAssignee = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, input.role),
                eq(dossierAssignments.assigneeId, input.assigneeId),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { id: true },
        });
        if (sameAssignee) {
            throw httpError.conflict(
                `Assignee already has an active ${input.role} assignment for this dossier`,
            );
        }
    }

    const result = await db.transaction(async (tx) => {
        const now = new Date();
        await cancelInProgressAssignmentsForReassign(tx, {
            dossierId: input.dossierId,
            actorId: input.actorId,
            dossierStatus: dossier.status,
            now,
            roles: input.role === WorkerRole.MAKER
                ? [WorkerRole.MAKER]
                : [input.role],
        });

        if (input.role === WorkerRole.MAKER) {
            await resetDossierEntryStatusAfterMakerReassign(tx, input.dossierId);
        }

        const assignment = await createDossierAssignmentInTx(tx, {
            dossierId: input.dossierId,
            assigneeId: input.assigneeId,
            role: input.role,
            actorId: input.actorId,
            dossierStatus: dossier.status as DossierStatus,
        });

        return { assignment, dossier };
    });

    scheduleDossierAssignedNotification({
        dossierId: result.dossier.id,
        assigneeId: result.assignment.assigneeId,
        workerRole: input.role,
        dossierName: result.dossier.name,
        folderId: result.dossier.folderId,
    });

    return result;
}

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

export async function findDossiersInLeafFoldersWithFiles(folderId: string) {
    const rootFolder = await db.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
    });

    if (!rootFolder) {
        throw httpError.notFound("Folder not found");
    }

    const subtreeFolders = await db.query.folders.findMany({
        where: activeFolderWhere(
            or(
                eq(folders.id, folderId),
                like(folders.folderPath, `${rootFolder.folderPath}/%`),
            ),
        ),
        orderBy: asc(folders.folderPath),
    });

    const folderById = new Map(subtreeFolders.map((folder) => [folder.id, folder]));
    const folderIds = subtreeFolders.map((folder) => folder.id);

    if (folderIds.length === 0) {
        return { rootFolder, leafFolders: [], dossiers: [] as DossierAssignTarget[] };
    }

    const dossierRows = await db
        .select({
            dossierId: dossiers.id,
            folderId: dossiers.folderId,
            name: dossiers.name,
        })
        .from(dossiers)
        .innerJoin(dossierFiles, eq(dossierFiles.dossierId, dossiers.id))
        .where(activeDossierWhere(inArray(dossiers.folderId, folderIds)));

    const dossiersByFolderId = new Map<string, DossierAssignTarget[]>();
    const foldersWithFiles = new Set<string>();

    for (const row of dossierRows) {
        foldersWithFiles.add(row.folderId);
        const list = dossiersByFolderId.get(row.folderId) ?? [];
        if (!list.some((item) => item.dossierId === row.dossierId)) {
            list.push(row);
        }
        dossiersByFolderId.set(row.folderId, list);
    }

    const leafFolderIds = [...foldersWithFiles].filter((candidateId) => {
        const candidate = folderById.get(candidateId);
        if (!candidate) {
            return false;
        }

        for (const otherId of foldersWithFiles) {
            if (otherId === candidateId) {
                continue;
            }

            const other = folderById.get(otherId);
            if (!other) {
                continue;
            }

            if (other.folderPath.startsWith(`${candidate.folderPath}/`)) {
                return false;
            }
        }

        return true;
    });

    const leafFolders = leafFolderIds
        .map((id) => folderById.get(id)!)
        .sort((a, b) => a.folderPath.localeCompare(b.folderPath));

    const seenDossierIds = new Set<string>();
    const dossiersToAssign: DossierAssignTarget[] = [];

    for (const leafFolderId of leafFolderIds) {
        for (const row of dossiersByFolderId.get(leafFolderId) ?? []) {
            if (seenDossierIds.has(row.dossierId)) {
                continue;
            }
            seenDossierIds.add(row.dossierId);
            dossiersToAssign.push(row);
        }
    }

    dossiersToAssign.sort((a, b) => a.name.localeCompare(b.name));

    return { rootFolder, leafFolders, dossiers: dossiersToAssign };
}

function sanitizeExportBaseName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type DossierWithFiles = {
    id: string;
    name: string;
    status: string;
    currentMetadataKey: string | null;
    files?: Array<{ fileName: string; filePath: string }>;
};

async function buildDossierMetadataExportBundle(
    dossier: DossierWithFiles,
    exportConfig?: MetadataExportConfig,
): Promise<DossierMetadataExportBundle> {
    if (!dossier.currentMetadataKey) {
        throw httpError.badRequest(`Dossier "${dossier.name}" has no current metadata`);
    }

    const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey);
    const rawMetadata = await downloadJsonFromStorage(metadataKey);

    if (!isDossierMetadata(rawMetadata)) {
        throw httpError.badRequest(`Invalid metadata format for dossier "${dossier.name}"`);
    }

    const baseName = rawMetadata.ho_so_id || dossier.name || dossier.id;
    const safeBaseName = sanitizeExportBaseName(baseName);
    const excelFileName = `${safeBaseName}-metadata.xlsx`;
    const excelBuffer = await buildDynamicMetadataExcel([rawMetadata], { exportConfig });

    const pdfSources = collectMetadataPdfSources(rawMetadata, dossier.files ?? []);
    const pdfFiles = await Promise.all(
        pdfSources.map(async (source) => ({
            fileName: source.fileName,
            data: await downloadBinaryFromStorage(source.storageKey),
        })),
    );

    return {
        dossierFolderName: safeBaseName,
        excelFileName,
        excelBuffer,
        pdfFiles,
    };
}

async function findDossiersInFolderSubtree(folderId: string) {
    const rootFolder = await db.query.folders.findFirst({
        where: activeFolderWhere(eq(folders.id, folderId)),
    });

    if (!rootFolder) {
        throw httpError.notFound("Folder not found");
    }

    const subtreeFolders = await db.query.folders.findMany({
        where: activeFolderWhere(
            or(
                eq(folders.id, folderId),
                like(folders.folderPath, `${rootFolder.folderPath}/%`),
            ),
        ),
    });
    const folderIds = subtreeFolders.map((folder) => folder.id);

    if (folderIds.length === 0) {
        return { rootFolder, dossiers: [] as DossierWithFiles[] };
    }

    const dossierRows = await db.query.dossiers.findMany({
        where: activeDossierWhere(inArray(dossiers.folderId, folderIds)),
        with: { files: true },
        orderBy: asc(dossiers.name),
    });

    return { rootFolder, dossiers: dossierRows };
}

async function validateApprovedFolderMetadataExport(folderId: string) {
    const { rootFolder, dossiers: allDossiers } = await findDossiersInFolderSubtree(folderId);

    if (allDossiers.length === 0) {
        throw httpError.badRequest("No dossiers found in this folder");
    }

    const notApproved = allDossiers.filter((dossier) => dossier.status !== DossierStatus.APPROVED);
    if (notApproved.length > 0) {
        const pendingNames = notApproved.map((dossier) => dossier.name).join(", ");
        throw httpError.badRequest(
            `Cannot export: all dossiers in this folder must be approved. Pending dossiers: ${pendingNames}`,
        );
    }

    const withoutMetadata = allDossiers.filter((dossier) => !dossier.currentMetadataKey);
    if (withoutMetadata.length > 0) {
        const missingNames = withoutMetadata.map((dossier) => dossier.name).join(", ");
        throw httpError.badRequest(
            `Cannot export: some dossiers are missing metadata: ${missingNames}`,
        );
    }

    return { rootFolder, dossiers: allDossiers };
}

async function loadDossierMetadataFromStorage(dossier: DossierWithFiles) {
    const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey!);
    const rawMetadata = await downloadJsonFromStorage(metadataKey);

    if (!isDossierMetadata(rawMetadata)) {
        throw httpError.badRequest(`Invalid metadata format for dossier "${dossier.name}"`);
    }

    return rawMetadata;
}

async function buildDossierPdfExportBundle(
    dossier: DossierWithFiles,
    metadata: DossierMetadata,
) {
    const baseName = metadata.ho_so_id || dossier.name || dossier.id;
    const dossierFolderName = sanitizeExportBaseName(baseName);
    const pdfSources = collectMetadataPdfSources(metadata, dossier.files ?? []);
    const pdfFiles = await Promise.all(
        pdfSources.map(async (source) => ({
            fileName: source.fileName,
            data: await downloadBinaryFromStorage(source.storageKey),
        })),
    );

    return { dossierFolderName, pdfFiles };
}

async function assignDossiersByFolderId(input: {
    folderId: string;
    assigneeId: string;
    role: WorkerRoleType;
    actorId: string;
}) {
    const { rootFolder, leafFolders, dossiers: targets } =
        await findDossiersInLeafFoldersWithFiles(input.folderId);

    const emptyResult = {
        folder: {
            id: rootFolder.id,
            folderPath: rootFolder.folderPath,
            folderName: rootFolder.folderName,
        },
        leafFolders: leafFolders.map((folder) => ({
            id: folder.id,
            folderPath: folder.folderPath,
            folderName: folder.folderName,
        })),
        assignments: [] as Array<typeof dossierAssignments.$inferSelect>,
        assigned: [] as Array<{
            dossierId: string;
            assignment: typeof dossierAssignments.$inferSelect;
            dossier: typeof dossiers.$inferSelect;
        }>,
        skipped: [] as Array<{ dossierId: string; folderId: string; reason: string }>,
        totalTargeted: targets.length,
        totalAssigned: 0,
        totalSkipped: 0,
    };

    if (targets.length === 0) {
        return emptyResult;
    }

    await ensureAssigneeExists(input.assigneeId);

    const dossierIds = targets.map((target) => target.dossierId);

    const [dossierRecords, activeAssignments, completedMakers] = await Promise.all([
        db.query.dossiers.findMany({
            where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, input.role),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            columns: { dossierId: true, assigneeId: true },
        }),
        input.role === WorkerRole.MAKER
            ? db.query.dossierAssignments.findMany({
                where: and(
                    inArray(dossierAssignments.dossierId, dossierIds),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                ),
                columns: { dossierId: true, assigneeId: true },
            })
            : Promise.resolve([]),
    ]);

    const dossierById = new Map(dossierRecords.map((dossier) => [dossier.id, dossier]));
    const activeMakerIndex = input.role === WorkerRole.MAKER
        ? buildActiveMakerIndex(activeAssignments)
        : buildActiveMakerIndex([]);
    const completedMakerIndex = buildCompletedMakerIndex(completedMakers);

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const pending: Array<{ target: DossierAssignTarget; dossier: typeof dossiers.$inferSelect }> = [];

    for (const target of targets) {
        const dossier = dossierById.get(target.dossierId);
        if (!dossier) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: "Dossier not found",
            });
            continue;
        }

        if (input.role === WorkerRole.MAKER) {
            const blockReason = getMakerAssignmentBlockReason({
                dossierStatus: dossier.status,
                dossierId: target.dossierId,
                activeMakerIndex,
                completedMakerIndex,
            });
            if (blockReason) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: blockReason,
                });
                continue;
            }
            if (hasCompletedMakerOnDossier(completedMakerIndex, target.dossierId)) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: "Cannot re-assign: a maker has already submitted entry",
                });
                continue;
            }
        } else {
            const completedRole = await db.query.dossierAssignments.findFirst({
                where: and(
                    eq(dossierAssignments.dossierId, target.dossierId),
                    eq(dossierAssignments.role, input.role),
                    eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                ),
                columns: { id: true },
            });
            if (completedRole) {
                skipped.push({
                    dossierId: target.dossierId,
                    folderId: target.folderId,
                    reason: `Dossier already has a completed ${input.role} assignment`,
                });
                continue;
            }
        }

        const alreadyAssignedToSame = activeAssignments.some(
            (row) =>
                row.dossierId === target.dossierId
                && row.assigneeId === input.assigneeId,
        );
        if (alreadyAssignedToSame) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: `Assignee already has an active ${input.role} assignment for this dossier`,
            });
            continue;
        }

        pending.push({ target, dossier });
    }

    const assigned = await db.transaction(async (tx) => {
        const results: Array<{
            dossierId: string;
            assignment: typeof dossierAssignments.$inferSelect;
            dossier: typeof dossiers.$inferSelect;
        }> = [];
        const now = new Date();

        for (const { target, dossier } of pending) {
            await cancelInProgressAssignmentsForReassign(tx, {
                dossierId: target.dossierId,
                actorId: input.actorId,
                dossierStatus: dossier.status,
                now,
                roles: input.role === WorkerRole.MAKER
                    ? [WorkerRole.MAKER]
                    : [input.role],
            });

            if (input.role === WorkerRole.MAKER) {
                await resetDossierEntryStatusAfterMakerReassign(tx, target.dossierId);
            }

            const assignment = await createDossierAssignmentInTx(tx, {
                dossierId: target.dossierId,
                assigneeId: input.assigneeId,
                role: input.role,
                actorId: input.actorId,
                dossierStatus: dossier.status as DossierStatus,
            });

            results.push({
                dossierId: target.dossierId,
                assignment,
                dossier,
            });
        }

        return results;
    });

    for (const item of assigned) {
        scheduleDossierAssignedNotification({
            dossierId: item.dossier.id,
            assigneeId: item.assignment.assigneeId,
            workerRole: input.role,
            dossierName: item.dossier.name,
            folderId: item.dossier.folderId,
        });
    }

    return {
        folder: emptyResult.folder,
        leafFolders: emptyResult.leafFolders,
        assignments: assigned.map((item) => item.assignment),
        assigned,
        skipped,
        totalTargeted: targets.length,
        totalAssigned: assigned.length,
        totalSkipped: skipped.length,
    };
}

async function buildGroupFolderAssignDeps() {
    return {
        createDossierAssignmentInTx,
        ensureAssigneeExists,
    };
}

async function runGroupFolderAssignment(input: {
    groupId: string;
    groupName: string;
    roundNumber: number;
    folderId: string;
    dossiersPerEditor: number;
    editorUserIds: Array<{ userId: string; fullName: string | null; allowedFields: string[] | null }>;
    qcPeersByStep: Map<number, string[]>;
    actorId: string;
    mode: "initial" | "continue";
    targets: Array<{ dossierId: string; folderId: string; name: string }>;
    rootFolder: { id: string; folderPath: string; folderName: string };
    leafFolders: Array<{ id: string; folderPath: string; folderName: string }>;
}) {
    const { executeGroupFolderAssignment } = await import(
        "../group/group-folder-assign.ts"
    );
    const deps = await buildGroupFolderAssignDeps();

    return await executeGroupFolderAssignment({
        mode: input.mode,
        groupId: input.groupId,
        groupName: input.groupName,
        roundNumber: input.roundNumber,
        folderId: input.folderId,
        dossiersPerEditor: input.dossiersPerEditor,
        editorUserIds: input.editorUserIds,
        qcPeersByStep: input.qcPeersByStep,
        actorId: input.actorId,
        targets: input.targets,
        rootFolder: input.rootFolder,
        leafFolders: input.leafFolders,
        ...deps,
    });
}

async function assignDossiersByFolderToGroup(input: {
    groupId: string;
    groupName: string;
    roundNumber: number;
    folderId: string;
    dossiersPerEditor: number;
    editorUserIds: Array<{ userId: string; fullName: string | null; allowedFields: string[] | null }>;
    qcPeersByStep: Map<number, string[]>;
    actorId: string;
    mode?: "initial" | "continue";
}) {
    const { rootFolder, leafFolders, dossiers: targets } =
        await findDossiersInLeafFoldersWithFiles(input.folderId);

    return await runGroupFolderAssignment({
        ...input,
        mode: input.mode ?? "initial",
        targets,
        rootFolder,
        leafFolders,
    });
}

export async function resolveGroupAssignFolderId(
    dossierId: string,
    groupId: string,
    dossierFolderId: string,
) {
    const ancestors: Array<{ id: string; folderPath: string; parentId: string | null }> = [];
    let currentId: string | null = dossierFolderId;

    while (currentId) {
        const folder = await db.query.folders.findFirst({
            where: activeFolderWhere(eq(folders.id, currentId)),
            columns: { id: true, folderPath: true, parentId: true },
        });
        if (!folder) {
            break;
        }
        ancestors.push(folder);
        currentId = folder.parentId;
    }

    // Shallowest first: match the folder used at initial group assign (not the dossier leaf).
    ancestors.sort((a, b) => a.folderPath.length - b.folderPath.length);

    for (const ancestor of ancestors) {
        const { dossiers: targets } = await findDossiersInLeafFoldersWithFiles(ancestor.id);
        if (!targets.some((target) => target.dossierId === dossierId)) {
            continue;
        }

        const targetIds = targets.map((target) => target.dossierId);
        if (targetIds.length === 0) {
            continue;
        }

        const groupPoolDossiers = await db.query.dossiers.findMany({
            where: activeDossierWhere(
                inArray(dossiers.id, targetIds),
                eq(dossiers.assignedGroupId, groupId),
            ),
            columns: { id: true },
        });

        if (groupPoolDossiers.length === targetIds.length) {
            return ancestor.id;
        }
    }

    return null;
}

async function mapDossierFilesWithFullPath(
    files: Array<{
        id: string;
        fileName: string;
        filePath: string;
        fileSizeKb: number | null;
    }>,
) {
    return await Promise.all(
        [...files]
            .sort((a, b) => a.fileName.localeCompare(b.fileName))
            .map(async (file) => {
                const searchablePdfPath = toSearchablePdfKey(file.filePath);
                return {
                    id: file.id,
                    fileName: file.fileName,
                    filePath: file.filePath,
                    fileSizeKb: file.fileSizeKb,
                    fullPath: await buildFileFullPath(file.filePath),
                    searchablePdfPath,
                    searchablePdfFullPath: searchablePdfPath
                        ? await buildFileFullPath(searchablePdfPath)
                        : null,
                };
            }),
    );
}

const METADATA_EDITOR_ROLES = [
    WorkerRole.MAKER,
    ...QC_CHECKER_WORKFLOW.map((config) => config.role),
] as const;

type AssignmentWithDossierRow = {
    id: string;
    role: WorkerRoleType;
    status: string;
    workQuality: string | null;
    attemptNumber: number;
    stepNumber: number;
    assignedAt: Date;
    completedAt: Date | null;
    dossier: {
        id: string;
        name: string;
        folderPath: string;
        status: string;
        entityType: string;
        currentQcStep: number;
        requiredQcCount: number;
        rejectCount: number;
        currentMetadataKey: string | null;
        ocrMetadataKey: string | null;
        updatedAt: Date;
        deletedAt: Date | null;
        files: Array<{
            id: string;
            fileName: string;
            filePath: string;
            fileSizeKb: number | null;
        }>;
    } | null;
};

async function mapAssignmentRowsToResponse(
    rows: AssignmentWithDossierRow[],
    issueReportsByDossierId?: Map<string, IssueReportResponse[]>,
) {
    return await Promise.all(
        rows
            .filter((row) => isActiveDossier(row.dossier))
            .map(async (row) => {
                const rawMetadataKey = resolveMetadataKeyForDossierEditor({
                    assignmentId: row.id,
                    assignmentStatus: row.status,
                    currentMetadataKey: row.dossier!.currentMetadataKey,
                    ocrMetadataKey: row.dossier!.ocrMetadataKey,
                });
                const metadataKeyJson = rawMetadataKey && !rawMetadataKey.endsWith(".json")
                    ? `${rawMetadataKey}.json`
                    : rawMetadataKey;
                const currentMetadataUrl = await buildLinkGet(metadataKeyJson);

                return {
                    id: row.id,
                    role: row.role,
                    status: row.status,
                    workQuality: row.workQuality,
                    attemptNumber: row.attemptNumber,
                    stepNumber: row.stepNumber,
                    assignedAt: row.assignedAt,
                    completedAt: row.completedAt,
                    currentMetadataUrl,
                    ...(issueReportsByDossierId
                        ? {
                            issueReports: issueReportsByDossierId.get(row.dossier!.id) ?? [],
                        }
                        : {}),
                    dossier: {
                        ...row.dossier!,
                        files: await mapDossierFilesWithFullPath(row.dossier!.files ?? []),
                    },
                };
            }),
    );
}

async function listMyAssignmentsByRole(
    assigneeId: string,
    input: Static<typeof listAssignmentsByRoleQuerySchema>,
) {
    const conditions = [
        eq(dossierAssignments.assigneeId, assigneeId),
        eq(dossierAssignments.role, input.role),
    ];

    if (input.status) {
        conditions.push(eq(dossierAssignments.status, input.status));
    }

    const rows = await db.query.dossierAssignments.findMany({
        where: and(...conditions),
        with: {
            dossier: {
                columns: {
                    id: true,
                    name: true,
                    folderPath: true,
                    status: true,
                    entityType: true,
                    currentQcStep: true,
                    requiredQcCount: true,
                    rejectCount: true,
                    currentMetadataKey: true,
                    ocrMetadataKey: true,
                    updatedAt: true,
                    deletedAt: true,
                },
                with: {
                    files: {
                        columns: {
                            id: true,
                            fileName: true,
                            filePath: true,
                            fileSizeKb: true,
                        },
                        orderBy: asc(dossierFiles.fileName),
                    },
                },
            },
        },
        orderBy: desc(dossierAssignments.assignedAt),
    });

    const includeIssueReports = input.role !== WorkerRole.MAKER;
    const issueReportsByDossierId = includeIssueReports
        ? await IssueReportService.listOpenForDossiers(
            rows
                .map((row) => row.dossier?.id)
                .filter((id): id is string => !!id),
        )
        : undefined;

    const assignments = await mapAssignmentRowsToResponse(rows, issueReportsByDossierId);

    return {
        role: input.role,
        status: input.status ?? null,
        assignments,
        totalAssignments: assignments.length,
    };
}

async function listMyDraftAssignments(assigneeId: string) {
    const draftListBlockedDossierStatuses = new Set<string>([
        DossierStatus.APPROVED,
        DossierStatus.WAITING_ISSUE_RESOLUTION,
        ...QC_CHECKER_WORKFLOW.flatMap((config) => [config.waiting, config.processing]),
    ]);

    const rows = await db.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.assigneeId, assigneeId),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
            inArray(dossierAssignments.role, [...METADATA_EDITOR_ROLES]),
        ),
        with: {
            dossier: {
                columns: {
                    id: true,
                    name: true,
                    folderPath: true,
                    status: true,
                    entityType: true,
                    currentQcStep: true,
                    requiredQcCount: true,
                    rejectCount: true,
                    currentMetadataKey: true,
                    ocrMetadataKey: true,
                    updatedAt: true,
                    deletedAt: true,
                },
                with: {
                    files: {
                        columns: {
                            id: true,
                            fileName: true,
                            filePath: true,
                            fileSizeKb: true,
                        },
                        orderBy: asc(dossierFiles.fileName),
                    },
                },
            },
        },
        orderBy: desc(dossierAssignments.assignedAt),
    });

    const activeRows = rows.filter((row) =>
        isActiveDossier(row.dossier)
        && !draftListBlockedDossierStatuses.has(row.dossier.status)
    );

    const assignments = await mapAssignmentRowsToResponse(activeRows);

    return {
        assignments,
        totalAssignments: assignments.length,
    };
}

async function loadFolderSubtreeForBulkDelete(folderId: string, permanent: boolean) {
    const rootFolder = await db.query.folders.findFirst({
        where: permanent
            ? eq(folders.id, folderId)
            : activeFolderWhere(eq(folders.id, folderId)),
    });

    if (!rootFolder) {
        throw httpError.notFound("Folder not found");
    }

    const subtreeFolderCondition = permanent
        ? or(
            eq(folders.id, folderId),
            like(folders.folderPath, `${rootFolder.folderPath}/%`),
        )
        : activeFolderWhere(
            or(
                eq(folders.id, folderId),
                like(folders.folderPath, `${rootFolder.folderPath}/%`),
            ),
        );

    const subtreeFolders = await db.query.folders.findMany({
        where: subtreeFolderCondition,
        orderBy: asc(folders.folderPath),
    });

    const folderIds = subtreeFolders.map((folder) => folder.id);
    if (folderIds.length === 0) {
        return { rootFolder, subtreeFolders, dossiers: [] as Array<typeof dossiers.$inferSelect & { files: typeof dossierFiles.$inferSelect[] }> };
    }

    const dossierRows = await db.query.dossiers.findMany({
        where: permanent
            ? inArray(dossiers.folderId, folderIds)
            : activeDossierWhere(inArray(dossiers.folderId, folderIds)),
        with: { files: true },
        orderBy: asc(dossiers.name),
    });

    return { rootFolder, subtreeFolders, dossiers: dossierRows };
}

export const DossierService = {
    ...crud,

    async create(input: Static<typeof createDossierSchema>) {
        await ProjectService.assertProjectExists(input.projectCode);

        const folderId = await db.transaction(async (tx) => {
            if (input.folderPath) {
                return await ensureFolderTree(tx, input.folderPath, input.projectCode);
            }

            const folder = await tx.query.folders.findFirst({
                where: activeFolderWhere(eq(folders.id, input.folderId)),
            });

            if (!folder) {
                throw httpError.notFound("Folder not found");
            }

            await reconcileFolderProjectCode(
                tx,
                folder,
                folder.folderPath,
                input.projectCode,
            );

            return input.folderId;
        });

        return await crud.create({
            ...input,
            folderId,
        });
    },

    async update(id: string, input: Static<typeof updateDossierSchema>) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.dossiers.findFirst({
                where: activeDossierWhere(eq(dossiers.id, id)),
            });

            if (!existing) {
                throw httpError.notFound("Dossier not found");
            }

            const updatePayload: Record<string, unknown> = {
                ...input,
                updatedAt: new Date(),
            };

            if (input.projectCode) {
                await ProjectService.assertProjectExists(input.projectCode);
            }

            if (input.folderPath) {
                const projectCode = input.projectCode ?? existing.projectCode;
                if (!projectCode) {
                    throw httpError.badRequest(
                        "projectCode is required when changing folderPath",
                    );
                }

                const folderId = await ensureFolderTree(tx, input.folderPath, projectCode);
                updatePayload.folderId = folderId;
            }

            const [row] = await tx
                .update(dossiers)
                .set(updatePayload)
                .where(activeDossierWhere(eq(dossiers.id, id)))
                .returning();

            if (!row) {
                throw httpError.notFound("Dossier not found");
            }

            const relRows = await tx.query.dossiers.findMany({
                where: (r: any, { inArray }: any) => inArray(r.id, [id]),
                with: { folder: true, files: true },
            });

            return relRows[0] ?? row;
        });
    },

    async delete(id: string, options?: { permanent?: boolean }) {
        const existing = await db.query.dossiers.findFirst({
            where: eq(dossiers.id, id),
            with: {
                files: true,
            },
        });

        if (!existing) {
            throw httpError.notFound("Dossier not found");
        }

        if (options?.permanent) {
            const assignments = await db.query.dossierAssignments.findMany({
                where: eq(dossierAssignments.dossierId, id),
                columns: { metadataKey: true },
            });

            const historyRows = await db
                .select({ s3Key: metadataHistory.s3Key })
                .from(metadataHistory)
                .where(eq(metadataHistory.dossierId, id));

            const storageKeys = collectDossierStorageKeys(
                existing,
                existing.files ?? [],
                assignments,
            );
            for (const { s3Key } of historyRows) {
                if (s3Key) storageKeys.add(s3Key);
            }

            const deletedObjectCount = await purgeDossierFromMinIO(
                storageKeys,
                existing.folderPath,
            );

            const deletedFolderIds = await db.transaction(async (tx) => {
                await purgeLinkedMetadataByDossierIds(tx, [id]);
                await tx.delete(dossiers).where(eq(dossiers.id, id));
                return await deleteOrphanFoldersAfterDossier(tx, existing.folderId);
            });

            return {
                id,
                mode: "permanent" as const,
                deletedObjectCount,
                deletedFolderIds,
            };
        }

        if (existing.deletedAt) {
            throw httpError.notFound("Dossier not found");
        }

        const now = new Date();
        const softResult = await db.transaction(async (tx) => {
            const [row] = await tx
                .update(dossiers)
                .set({ deletedAt: now, updatedAt: now })
                .where(activeDossierWhere(eq(dossiers.id, id)))
                .returning({ id: dossiers.id });

            if (!row) {
                return null;
            }

            const deletedFolderIds = await softDeleteOrphanFoldersAfterDossier(
                tx,
                existing.folderId,
                now,
            );

            return { id: row.id, deletedFolderIds };
        });

        if (!softResult) {
            throw httpError.notFound("Dossier not found");
        }

        return {
            id: softResult.id,
            mode: "soft" as const,
            deletedFolderIds: softResult.deletedFolderIds,
        };
    },

    async deleteByFolderId(folderId: string, options?: { permanent?: boolean }) {
        const permanent = options?.permanent === true;
        const { rootFolder, subtreeFolders, dossiers: dossierList } =
            await loadFolderSubtreeForBulkDelete(folderId, permanent);

        const dossierIds = dossierList.map((d) => d.id);
        const folderIdsOrdered = sortFoldersDeepestFirst(subtreeFolders).map((f) => f.id);

        if (permanent) {
            let deletedObjectCount = 0;

            for (const dossier of dossierList) {
                const assignments = await db.query.dossierAssignments.findMany({
                    where: eq(dossierAssignments.dossierId, dossier.id),
                    columns: { metadataKey: true },
                });
                const historyRows = await db
                    .select({ s3Key: metadataHistory.s3Key })
                    .from(metadataHistory)
                    .where(eq(metadataHistory.dossierId, dossier.id));

                const storageKeys = collectDossierStorageKeys(
                    dossier,
                    dossier.files ?? [],
                    assignments,
                );
                for (const { s3Key } of historyRows) {
                    if (s3Key) storageKeys.add(s3Key);
                }
                deletedObjectCount += await purgeDossierFromMinIO(
                    storageKeys,
                    dossier.folderPath,
                );
            }

            const deletedFolderIds = await db.transaction(async (tx) => {
                await purgeLinkedMetadataByDossierIds(tx, dossierIds);
                if (dossierIds.length > 0) {
                    await tx.delete(dossiers).where(inArray(dossiers.id, dossierIds));
                }
                return await hardDeleteFoldersByIds(tx, folderIdsOrdered);
            });

            return {
                folderId,
                folderPath: rootFolder.folderPath,
                mode: "permanent" as const,
                deletedDossierIds: dossierIds,
                deletedFolderIds,
                deletedObjectCount,
                totalDossiers: dossierIds.length,
            };
        }

        const now = new Date();
        const softResult = await db.transaction(async (tx) => {
            const deletedDossierRows = dossierIds.length > 0
                ? await tx
                    .update(dossiers)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(and(
                        inArray(dossiers.id, dossierIds),
                        activeDossierWhere(),
                    ))
                    .returning({ id: dossiers.id })
                : [];

            const deletedFolderIds = await softDeleteFoldersByIds(
                tx,
                folderIdsOrdered,
                now,
            );

            return {
                deletedDossierIds: deletedDossierRows.map((row) => row.id),
                deletedFolderIds,
            };
        });

        return {
            folderId,
            folderPath: rootFolder.folderPath,
            mode: "soft" as const,
            deletedDossierIds: softResult.deletedDossierIds,
            deletedFolderIds: softResult.deletedFolderIds,
            totalDossiers: softResult.deletedDossierIds.length,
        };
    },

    async createUploadPoint(input: Static<typeof createUploadPointBodySchema>) {
        if (input.projectCode) {
            await ProjectService.assertProjectExists(input.projectCode);
        }

        const s3 = await getS3Client();
        if (!s3) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }

        const bucket = resolveS3Bucket();
        const prefix = input.prefix ?? (
            input.projectCode
                ? `raw/${input.projectCode}/${crypto.randomUUID()}/`
                : `raw/${crypto.randomUUID()}/`
        );
        const result = await s3.generatePresignedPostPolicy({
            bucket,
            prefix,
            expiry: input.expiry,
            maxFileSize: input.maxFileSize,
            contentTypePrefix: input.contentTypePrefix,
        });

        return {
            ...result,
            bucket,
            ...(input.projectCode ? { projectCode: input.projectCode } : {}),
        };
    },

    async checkFilePathExists(filePath: string) {
        const normalizedPath = normalizeStorageKey(filePath);
        const existing = await db.query.dossierFiles.findFirst({
            where: eq(dossierFiles.filePath, normalizedPath),
            with: {
                dossier: {
                    columns: { id: true, deletedAt: true },
                },
            },
        });

        if (!existing || !isActiveDossier(existing.dossier)) {
            return { exists: false as const };
        }

        return {
            exists: true as const,
            fileId: existing.id,
        };
    },

    async createDocumentFromStorage(input: Static<typeof createDocumentFromStorageBodySchema>) {
        const key = normalizeStorageKey(input.key);

        // Dossiers under raw/ keep the caller projectCode; the shared raw/ root
        // folder itself stays unscoped (see ensureFolderTree).
        const projectCode = input.projectCode ?? null;

        if (projectCode !== null) {
            await ProjectService.assertProjectExists(projectCode);
        }

        const { fileSizeKb } = await statStorageObject(key);

        const filePath = key;
        const folderPath = storageDirname(filePath);
        if (!folderPath) {
            throw httpError.badRequest("File key must include a folder path");
        }

        await assertNoMixedStorageFolderLayoutOnAdd(filePath, filePath);

        const folderName = folderNameFromPath(folderPath);
        const fileName = storageBasename(filePath);

        return await db.transaction(async (tx) => {
            const folderId = await ensureFolderTree(tx, folderPath, projectCode);
            const dossier = await findOrCreateDossier(
                tx,
                folderId,
                folderPath,
                folderName,
                projectCode,
            );
            const { file, created } = await insertDossierFile(
                tx,
                dossier.id,
                fileName,
                filePath,
                fileSizeKb,
            );

            return { dossier, file, created };
        });
    },

    async assignDossier(
        input: { dossierId: string } & Static<typeof assignDossierBodySchema>,
        actorId: string,
    ) {
        return await assignDossierToUser({
            dossierId: input.dossierId,
            assigneeId: input.assigneeId,
            role: input.role,
            actorId,
        });
    },

    async assignByFolderId(
        input: Static<typeof assignByFolderIdBodySchema> & { assigneeId: string },
        actorId: string,
    ) {
        return await assignDossiersByFolderId({
            folderId: input.folderId,
            assigneeId: input.assigneeId,
            role: input.role,
            actorId,
        });
    },

    async revokeByFolderId(folderId: string, actorId: string) {
        const { rootFolder, leafFolders, dossiers: targets } =
            await findDossiersInLeafFoldersWithFiles(folderId);

        return await executeFolderAssignmentRevoke({
            folderId,
            actorId,
            targets,
            rootFolder,
            leafFolders,
        });
    },

    async assignByFolderToGroup(input: {
        groupId: string;
        groupName: string;
        roundNumber: number;
        folderId: string;
        dossiersPerEditor: number;
        editorUserIds: Array<{ userId: string; fullName: string | null; allowedFields: string[] | null }>;
        qcPeersByStep: Map<number, string[]>;
        actorId: string;
        mode?: "initial" | "continue";
    }) {
        return await assignDossiersByFolderToGroup(input);
    },

    async listDraftAssignments(assigneeId: string) {
        return await listMyDraftAssignments(assigneeId);
    },

    async listAssignmentsByRole(
        assigneeId: string,
        input: Static<typeof listAssignmentsByRoleQuerySchema>,
    ) {
        return await listMyAssignmentsByRole(assigneeId, input);
    },

    async bulkSubmitDraftAssignments(
        actorId: string,
        items: Array<{ dossierId: string; metadata: unknown; issue_report?: import("../issue-report/types.ts").IssueReportInput }>,
    ) {
        return await bulkSubmitDraftMetadata(actorId, items);
    },

    async saveDossierMetadata(
        dossierId: string,
        metadata: unknown,
        actorId: string,
        issueReport?: import("../issue-report/types.ts").IssueReportInput,
    ) {
        const assignment = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, dossierId),
                eq(dossierAssignments.assigneeId, actorId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ),
            with: { dossier: true },
        });

        if (!isActiveDossier(assignment?.dossier)) {
            throw httpError.notFound("No workable MAKER assignment found for this dossier");
        }

        const dossier = assignment.dossier;

        if (!dossier.ocrMetadataKey) {
            throw httpError.badRequest("Dossier has no OCR metadata key");
        }

        // Non-null after guard above.
        const ocrMetadataKey: string = dossier.ocrMetadataKey;

        // Validate field-level write permission when ACL is active.
        const allowedFields = parseAllowedFields(assignment.allowedFields);
        if (allowedFields !== null) {
            if (!isDossierMetadata(metadata)) {
                throw httpError.badRequest("Invalid metadata format");
            }
            const { allowed, violations } = validateWritePermission(metadata, allowedFields);
            if (!allowed) {
                throw httpError.forbidden(
                    `Field write permission denied for: ${violations.join(", ")}`,
                );
            }
        }

        // Derive per-maker storage key using assignment ID to avoid collisions.
        const ocrBase = ocrMetadataKey.replace(/\.json$/i, "");
        const partialBase = ocrBase.replace(/(^|\/)metadata\//, "$1metadata_partial/");
        const partialKey = `${partialBase}_${assignment.id.slice(0, 8)}.json`;

        await deleteDossierDraftMetadata({
            currentMetadataKey: dossier.currentMetadataKey,
            ocrMetadataKey: dossier.ocrMetadataKey,
            assignmentId: assignment.id,
        });
        const storedKey = await uploadJsonToStorage(partialKey, metadata);
        const fromStatus = dossier.status;
        const previousMetadataKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
        const now = new Date();

        const result = await db.transaction(async (tx) => {
            const [assignmentRow] = await tx
                .update(dossierAssignments)
                .set({
                    metadataKey: storedKey,
                    status: AssignmentStatus.COMPLETED,
                    workQuality: assignment.workQuality === WorkQuality.INCORRECT
                        ? WorkQuality.INCORRECT
                        : WorkQuality.CORRECT,
                    completedAt: now,
                    rejectFields: null,
                })
                .where(and(
                    eq(dossierAssignments.id, assignment.id),
                    inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                ))
                .returning();

            if (!assignmentRow) {
                throw httpError.conflict("Assignment is no longer in progress");
            }

            // Count remaining IN_PROGRESS MAKER assignments for this dossier.
            const remainingMakers = await tx.query.dossierAssignments.findMany({
                where: and(
                    eq(dossierAssignments.dossierId, dossierId),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
                ),
                columns: { id: true },
            });

            if (remainingMakers.length > 0) {
                const skipQc = dossier.requiredQcCount === 0;
                if (issueReport) {
                    const { IssueReportService } = await import(
                        "../issue-report/issue-report-service.ts"
                    );
                    await IssueReportService.createOnMakerSubmit(tx, {
                        dossierId,
                        reporterId: actorId,
                        reporterAssignmentId: assignment.id,
                        issueReport,
                        directToProjectManager: skipQc,
                    });
                }

                // Partial submit — other MAKERs still working.
                await tx.insert(workflowLogs).values({
                    dossierId,
                    actorId,
                    action: "SUBMIT_ENTRY_PARTIAL",
                    fromStatus,
                    toStatus: fromStatus,
                    notes: issueReport
                        ? `${remainingMakers.length} maker(s) still in progress; issue report submitted`
                        : `${remainingMakers.length} maker(s) still in progress`,
                });

                return { partial: true, metadataKey: storedKey, dossierStatus: fromStatus };
            }

            // All MAKERs done — merge partials and transition dossier.
            const completedMakers = await tx.query.dossierAssignments.findMany({
                where: and(
                    eq(dossierAssignments.dossierId, dossierId),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                ),
                columns: { metadataKey: true, allowedFields: true, attemptNumber: true },
            });

            const editorAttemptNumber = Math.max(
                assignment.attemptNumber,
                ...completedMakers.map((m) => m.attemptNumber),
            );

            let finalMetadataKey = storedKey;

            const hasMultipleMakers = completedMakers.length > 1;
            const hasFieldLevelAcl = allowedFields !== null
                || completedMakers.some((m) => parseAllowedFields(m.allowedFields) !== null);
            const shouldMergeWithOcrBase = hasMultipleMakers || hasFieldLevelAcl;

            if (shouldMergeWithOcrBase) {
                // Download base (OCR) metadata and maker partial(s), then merge in-place.
                const ocrJsonKey = ocrMetadataKey.endsWith(".json")
                    ? ocrMetadataKey
                    : `${ocrMetadataKey}.json`;

                const rawBase = await downloadJsonFromStorage(ocrJsonKey);
                if (!isDossierMetadata(rawBase)) {
                    throw httpError.internal("Invalid base OCR metadata format");
                }

                const partials: DossierMetadata[] = [];
                for (const maker of completedMakers) {
                    if (!maker.metadataKey) continue;
                    const rawPartial = await downloadJsonFromStorage(
                        maker.metadataKey.endsWith(".json")
                            ? maker.metadataKey
                            : `${maker.metadataKey}.json`,
                    );
                    if (isDossierMetadata(rawPartial)) {
                        partials.push(rawPartial);
                    }
                }

                const merged = mergePartialMetadata(rawBase, partials);
                finalMetadataKey = await uploadJsonToStorage(
                    buildEditorMergedMetadataKey(ocrMetadataKey, editorAttemptNumber),
                    merged,
                );
            } else {
                const rawPartial = await downloadJsonFromStorage(
                    storedKey.endsWith(".json") ? storedKey : `${storedKey}.json`,
                );
                finalMetadataKey = await uploadJsonToStorage(
                    buildEditorMergedMetadataKey(ocrMetadataKey, editorAttemptNumber),
                    rawPartial,
                );
            }

            const skipQc = dossier.requiredQcCount === 0;
            const { hasBlockingIssueReportsForDossier, IssueReportService } = await import(
                "../issue-report/issue-report-service.ts"
            );
            const hasBlockingIssue = await hasBlockingIssueReportsForDossier(dossierId, tx);

            const toStatus = skipQc
                ? ((hasBlockingIssue || issueReport)
                    ? DossierStatus.WAITING_ISSUE_RESOLUTION
                    : DossierStatus.APPROVED)
                : DossierStatus.WAITING_CHECKER_1;

            const [dossierRow] = await tx
                .update(dossiers)
                .set({
                    status: toStatus,
                    currentQcStep: 0,
                    currentMetadataKey: finalMetadataKey,
                    updatedAt: now,
                })
                .where(activeDossierWhere(eq(dossiers.id, dossierId)))
                .returning();

            // After resubmit, QC restarts at CHECKER_1 (skip when no QC levels configured).
            if (!skipQc) {
                const checker1InProgress = await hasInProgressAssignment(
                    tx,
                    dossierId,
                    WorkerRole.CHECKER_1,
                );
                if (!checker1InProgress) {
                    await reopenRejectedCheckerAssignment(tx, {
                        dossierId,
                        role: WorkerRole.CHECKER_1,
                        now,
                    });
                }
            }

            await tx.insert(workflowLogs).values({
                dossierId,
                actorId,
                action: "SUBMIT_ENTRY",
                fromStatus,
                toStatus,
            });

            if (issueReport) {
                await IssueReportService.createOnMakerSubmit(tx, {
                    dossierId,
                    reporterId: actorId,
                    reporterAssignmentId: assignment.id,
                    issueReport,
                    directToProjectManager: skipQc,
                });
            }

            return {
                partial: false,
                metadataKey: finalMetadataKey,
                dossierStatus: dossierRow?.status ?? toStatus,
            };
        });

        const currentMetadataUrl = await buildLinkGet(result.metadataKey);

        // Record metadata history snapshot (best-effort, non-blocking).
        recordSnapshot({
            dossierId,
            actorId,
            role: WorkerRole.MAKER,
            action: result.partial ? "SUBMIT_ENTRY_PARTIAL" : "SUBMIT_ENTRY",
            fromStatus,
            toStatus: result.dossierStatus,
            s3Key: result.metadataKey,
            previousS3Key: previousMetadataKey,
        }).catch((err) => {
            console.error("[MetadataHistory] Failed to record maker snapshot:", err);
        });

        if (!result.partial && result.dossierStatus === DossierStatus.APPROVED) {
            generateAndPersistAip({ dossierId }).catch((err) => {
                console.error("[AIP] Failed to generate archival package:", err);
            });
        }

        if (!result.partial && dossier.assignedGroupId) {
            const { GroupService } = await import("../group/group-service.ts");
            try {
                await GroupService.autoContinueAfterMakerSubmit(
                    dossier.assignedGroupId,
                    actorId,
                    dossierId,
                    dossier.folderId,
                );
            } catch {
                // No free slots or empty queue — submit already succeeded.
            }
        }

        return {
            dossierId,
            assignmentId: assignment.id,
            currentMetadataKey: result.metadataKey,
            currentMetadataUrl,
            dossierStatus: result.dossierStatus,
            partial: result.partial,
        };
    },

    async saveMetadataDraft(dossierId: string, metadata: unknown, actorId: string) {
        return await persistMetadataDraft({
            dossierId,
            actorId,
            metadata,
        });
    },

    async getDossierMetadataDraft(dossierId: string, actorId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: {
                id: true,
                currentMetadataKey: true,
                ocrMetadataKey: true,
            },
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const assignment = await findWorkableEditorAssignment(dossierId, actorId);
        if (!assignment || assignment.status !== AssignmentStatus.DRAFT) {
            throw httpError.notFound("No DRAFT assignment found for this dossier");
        }

        const draftKey = resolveDossierDraftKey({
            currentMetadataKey: dossier.currentMetadataKey,
            ocrMetadataKey: dossier.ocrMetadataKey,
            assignmentId: assignment.id,
        });
        if (!draftKey) {
            throw httpError.badRequest("Cannot resolve draft metadata key for dossier");
        }

        const metadata = await downloadJsonFromStorage(resolveMetadataJsonKey(draftKey));

        return {
            dossierId,
            assignment,
            draftMetadataKey: draftKey,
            metadata,
        };
    },

    async exportMetadataExcel(
        dossierId: string,
        input?: {
            presetId?: string;
            columns?: MetadataExportConfig["columns"];
            placementId?: string;
        },
    ) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            with: { files: true },
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const exportConfig = input?.presetId || input?.columns
            ? await MetadataExportPresetService.resolveExportConfig(input)
            : undefined;

        const bundle = await buildDossierMetadataExportBundle(dossier, exportConfig);
        const pdfFiles = await maybeWatermarkPdfFiles(bundle.pdfFiles, input?.placementId);
        const buffer = await buildMetadataExportZip({
            excelFileName: bundle.excelFileName,
            excelBuffer: bundle.excelBuffer,
            pdfFiles,
        });
        const filename = `${bundle.dossierFolderName}-metadata-export.zip`;

        return { buffer, filename, contentType: "application/zip" as const };
    },

    async getDossierMetadataExportFields(dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }
        if (!dossier.currentMetadataKey) {
            throw httpError.badRequest(`Dossier "${dossier.name}" has no current metadata`);
        }

        const metadata = await loadDossierMetadataFromStorage(dossier);
        return buildUnionExportFieldCatalog([metadata]);
    },

    async previewDossierMetadataExport(
        dossierId: string,
        input: { presetId?: string; columns?: MetadataExportConfig["columns"] },
    ) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }
        if (!dossier.currentMetadataKey) {
            throw httpError.badRequest(`Dossier "${dossier.name}" has no current metadata`);
        }

        const exportConfig = await MetadataExportPresetService.resolveExportConfig(input);
        const metadata = await loadDossierMetadataFromStorage(dossier);
        return buildMetadataExportPreview([metadata], exportConfig);
    },

    async previewApprovedMetadataExportByFolder(
        folderId: string,
        input: { presetId?: string; columns?: MetadataExportConfig["columns"] },
    ) {
        const { dossiers: allDossiers } = await validateApprovedFolderMetadataExport(folderId);
        const exportConfig = await MetadataExportPresetService.resolveExportConfig(input);
        const metadataList = await Promise.all(
            allDossiers.map((dossier) => loadDossierMetadataFromStorage(dossier)),
        );
        return buildMetadataExportPreview(metadataList, exportConfig);
    },

    async exportDipHoso(dossierId: string) {
        return await buildDipHosoExport(dossierId);
    },

    async getAipStatus(dossierId: string) {
        return await queryAipStatus(dossierId);
    },

    async exportApprovedMetadataByFolder(
        folderId: string,
        input?: {
            presetId?: string;
            columns?: MetadataExportConfig["columns"];
            placementId?: string;
        },
    ) {
        const { rootFolder, dossiers: allDossiers } = await validateApprovedFolderMetadataExport(folderId);

        // Resolve placement + watermark image once for the whole folder export.
        const watermarkConfig = await resolveWatermarkApplyConfig(input?.placementId);

        const loaded = await Promise.all(
            allDossiers.map(async (dossier) => {
                const metadata = await loadDossierMetadataFromStorage(dossier);
                const pdfBundle = await buildDossierPdfExportBundle(dossier, metadata);
                pdfBundle.pdfFiles = await applyWatermarkConfigToPdfFiles(
                    pdfBundle.pdfFiles,
                    watermarkConfig,
                );
                return { metadata, pdfBundle };
            }),
        );

        const metadataList = loaded.map((item) => item.metadata);
        const exportConfig = input?.presetId || input?.columns
            ? await MetadataExportPresetService.resolveExportConfig(input)
            : undefined;
        const excelBuffer = await buildDynamicMetadataExcel(metadataList, { exportConfig });
        const safeFolderName = sanitizeExportBaseName(rootFolder.folderName);
        const excelFileName = `${safeFolderName}-metadata-export.xlsx`;
        const buffer = await buildFolderMetadataExportZip({
            excelFileName,
            excelBuffer,
            dossierPdfBundles: loaded.map((item) => item.pdfBundle),
        });
        const filename = `${safeFolderName}-approved-metadata-export.zip`;

        return {
            buffer,
            filename,
            contentType: "application/zip" as const,
            exportedCount: metadataList.length,
        };
    },

    async getFolderMetadataExportFields(folderId: string) {
        const { dossiers: allDossiers } = await validateApprovedFolderMetadataExport(folderId);
        const metadataList = await Promise.all(
            allDossiers.map((dossier) => loadDossierMetadataFromStorage(dossier)),
        );
        return buildUnionExportFieldCatalog(metadataList);
    },

    async ensureFolderTreeFromStorage(input: {
        folderPath: string;
        projectCode: string | null;
    }) {
        const normalized = normalizeStorageKey(input.folderPath);
        const projectCode = isRawStoragePath(normalized)
            ? null
            : (input.projectCode ?? null);
        const s3 = await getS3Client();
        if (s3) {
            const bucket = resolveS3Bucket();
            const prefix = normalized.endsWith("/") ? normalized : normalized + "/";
            await s3.getMinIOClient().putObject(bucket, prefix, Buffer.from(""));
        }
        
        await db.transaction(async (tx) => {
            await ensureFolderTree(tx, normalized, projectCode);
        });
        
        return { created: true, folderPath: normalized };
    },
};
