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
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    folderNameFromPath,
    normalizeStorageKey,
    splitFolderSegments,
    storageBasename,
    storageDirname,
} from "./dossier-path-utils.ts";
import { buildFileFullPath } from "./dossier-s3-utils.ts";
import {
    hasInProgressAssignment,
    reopenRejectedCheckerAssignment,
} from "../../libs/workflow-assignment-utils.ts";
import { buildLinkGet, downloadJsonFromStorage, resolveMetadataJsonKey, uploadJsonToStorage } from "../data-entry/data-entry-s3-utils.ts";
import { buildMetadataExcel } from "../../libs/metadata-excel-export.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import {
    assignByFolderIdBodySchema,
    assignDossierBodySchema,
    listAssignmentsByRoleQuerySchema,
    createDossierSchema,
    createDocumentFromStorageBodySchema,
    createUploadPointBodySchema,
    dossierEntitySchema,
    updateDossierSchema,
} from "./types.ts";

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
        where: eq(folders.folderPath, folderPath),
    });
}

async function ensureFolderTree(tx: DbTx, folderPath: string): Promise<string> {
    const segments = splitFolderSegments(folderPath);
    let parentId: string | null = null;

    for (const segmentPath of segments) {
        const result: { id: string }[] = await tx
            .insert(folders)
            .values({
                parentId,
                folderPath: segmentPath,
                folderName: folderNameFromPath(segmentPath),
            })
            .onConflictDoNothing({ target: folders.folderPath })
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
) {
    const [inserted] = await tx
        .insert(dossiers)
        .values({
            folderId,
            folderPath,
            name,
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.NEW,
        })
        .onConflictDoNothing({ target: [dossiers.folderPath, dossiers.name] })
        .returning();

    if (inserted) {
        return inserted;
    }

    const existing = await tx.query.dossiers.findFirst({
        where: and(eq(dossiers.folderPath, folderPath), eq(dossiers.name, name)),
    });

    if (!existing) {
        throw httpError.internal("Failed to resolve dossier after conflict");
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

async function getNextAttemptNumber(tx: DbTx, dossierId: string, role: WorkerRoleType) {
    const existing = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, role),
        ),
        columns: { attemptNumber: true },
    });

    if (existing.length === 0) {
        return 1;
    }

    return Math.max(...existing.map((a) => a.attemptNumber)) + 1;
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

async function createDossierAssignmentInTx(
    tx: DbTx,
    input: {
        dossierId: string;
        assigneeId: string;
        role: WorkerRoleType;
        actorId: string;
        dossierStatus: DossierStatus;
    },
) {
    const attemptNumber = await getNextAttemptNumber(tx, input.dossierId, input.role);

    const [assignment] = await tx
        .insert(dossierAssignments)
        .values({
            dossierId: input.dossierId,
            role: input.role,
            assigneeId: input.assigneeId,
            attemptNumber,
            status: AssignmentStatus.IN_PROGRESS,
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
        where: eq(dossiers.id, input.dossierId),
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    await ensureAssigneeExists(input.assigneeId);

    const existingActive = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, input.role),
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
        ),
    });

    if (existingActive) {
        throw httpError.conflict(
            `Dossier already has an active ${input.role} assignment`,
        );
    }

    const result = await db.transaction(async (tx) => {
        const assignment = await createDossierAssignmentInTx(tx, {
            dossierId: input.dossierId,
            assigneeId: input.assigneeId,
            role: input.role,
            actorId: input.actorId,
            dossierStatus: dossier.status as DossierStatus,
        });

        return { assignment, dossier };
    });

    return result;
}

type DossierAssignTarget = {
    dossierId: string;
    folderId: string;
    name: string;
};

async function findDossiersInLeafFoldersWithFiles(folderId: string) {
    const rootFolder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId),
    });

    if (!rootFolder) {
        throw httpError.notFound("Folder not found");
    }

    const subtreeFolders = await db.query.folders.findMany({
        where: or(
            eq(folders.id, folderId),
            like(folders.folderPath, `${rootFolder.folderPath}/%`),
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
        .where(inArray(dossiers.folderId, folderIds));

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

    const [dossierRecords, activeAssignments] = await Promise.all([
        db.query.dossiers.findMany({
            where: inArray(dossiers.id, dossierIds),
        }),
        db.query.dossierAssignments.findMany({
            where: and(
                inArray(dossierAssignments.dossierId, dossierIds),
                eq(dossierAssignments.role, input.role),
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ),
        }),
    ]);

    const dossierById = new Map(dossierRecords.map((dossier) => [dossier.id, dossier]));
    const activeDossierIds = new Set(activeAssignments.map((assignment) => assignment.dossierId));

    const skipped: Array<{ dossierId: string; folderId: string; reason: string }> = [];
    const pending: Array<{ target: DossierAssignTarget; dossier: typeof dossiers.$inferSelect }> = [];

    for (const target of targets) {
        if (activeDossierIds.has(target.dossierId)) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: `Dossier already has an active ${input.role} assignment`,
            });
            continue;
        }

        const dossier = dossierById.get(target.dossierId);
        if (!dossier) {
            skipped.push({
                dossierId: target.dossierId,
                folderId: target.folderId,
                reason: "Dossier not found",
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

        for (const { target, dossier } of pending) {
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
            .map(async (file) => ({
                id: file.id,
                fileName: file.fileName,
                filePath: file.filePath,
                fileSizeKb: file.fileSizeKb,
                fullPath: await buildFileFullPath(file.filePath),
            })),
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
                    updatedAt: true,
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

    const assignments = await Promise.all(
        rows
            .filter((row) => row.dossier)
            .map(async (row) => ({
                id: row.id,
                role: row.role,
                status: row.status,
                attemptNumber: row.attemptNumber,
                stepNumber: row.stepNumber,
                assignedAt: row.assignedAt,
                completedAt: row.completedAt,
                dossier: {
                    ...row.dossier!,
                    files: await mapDossierFilesWithFullPath(row.dossier!.files ?? []),
                },
            })),
    );

    return {
        role: input.role,
        status: input.status ?? null,
        assignments,
        totalAssignments: assignments.length,
    };
}

export const DossierService = {
    ...crud,

    async update(id: string, input: Static<typeof updateDossierSchema>) {
        return await db.transaction(async (tx) => {
            const updatePayload: Record<string, unknown> = {
                ...input,
                updatedAt: new Date(),
            };

            if (input.folderPath) {
                const folderId = await ensureFolderTree(tx, input.folderPath);
                updatePayload.folderId = folderId;
            }

            const [row] = await tx
                .update(dossiers)
                .set(updatePayload)
                .where(eq(dossiers.id, id))
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

    async delete(id: string) {
        const existing = await db.query.dossiers.findFirst({
            where: eq(dossiers.id, id),
        });

        if (!existing) {
            throw httpError.notFound("Dossier not found");
        }

        await db.delete(dossiers).where(eq(dossiers.id, id));
        return { id };
    },

    async createUploadPoint(input: Static<typeof createUploadPointBodySchema>) {
        const s3 = await getS3Client();
        if (!s3) {
            throw httpError.serviceUnavailable("S3 is not configured");
        }

        const bucket = resolveS3Bucket();
        const prefix = input.prefix ?? `raw/${crypto.randomUUID()}/`;
        const result = await s3.generatePresignedPostPolicy({
            bucket,
            prefix,
            expiry: input.expiry,
            maxFileSize: input.maxFileSize,
            contentTypePrefix: input.contentTypePrefix,
        });

        return { ...result, bucket };
    },

    async checkFilePathExists(filePath: string) {
        const normalizedPath = normalizeStorageKey(filePath);
        const existing = await db.query.dossierFiles.findFirst({
            where: eq(dossierFiles.filePath, normalizedPath),
        });

        if (!existing) {
            return { exists: false as const };
        }

        return {
            exists: true as const,
            fileId: existing.id,
        };
    },

    async createDocumentFromStorage(input: Static<typeof createDocumentFromStorageBodySchema>) {
        const key = normalizeStorageKey(input.key);
        const { fileSizeKb } = await statStorageObject(key);

        const filePath = key;
        const folderPath = storageDirname(filePath);
        if (!folderPath) {
            throw httpError.badRequest("File key must include a folder path");
        }

        const folderName = folderNameFromPath(folderPath);
        const fileName = storageBasename(filePath);

        return await db.transaction(async (tx) => {
            const folderId = await ensureFolderTree(tx, folderPath);
            const dossier = await findOrCreateDossier(tx, folderId, folderPath, folderName);
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

    async listAssignmentsByRole(
        assigneeId: string,
        input: Static<typeof listAssignmentsByRoleQuerySchema>,
    ) {
        return await listMyAssignmentsByRole(assigneeId, input);
    },

    async saveDossierMetadata(dossierId: string, metadata: unknown, actorId: string) {
        const assignment = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, dossierId),
                eq(dossierAssignments.assigneeId, actorId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ),
            with: { dossier: true },
        });

        if (!assignment?.dossier) {
            throw httpError.notFound("No in-progress MAKER assignment found for this dossier");
        }

        const dossier = assignment.dossier;

        if (!dossier.ocrMetadataKey) {
            throw httpError.badRequest("Dossier has no OCR metadata key");
        }

        // Derive save path: replace /metadata/ segment with /metadata_update/
        const saveKeyBase = dossier.ocrMetadataKey.replace(
            /(^|\/)metadata\//,
            "$1metadata_update/",
        );
        const saveKey = saveKeyBase.endsWith(".json") ? saveKeyBase : `${saveKeyBase}.json`;

        const storedKey = await uploadJsonToStorage(saveKey, metadata);
        const fromStatus = dossier.status;
        const toStatus = DossierStatus.WAITING_CHECKER_1;

        const now = new Date();

        const updatedDossier = await db.transaction(async (tx) => {
            const [assignmentRow] = await tx
                .update(dossierAssignments)
                .set({
                    metadataKey: storedKey,
                    status: AssignmentStatus.COMPLETED,
                    completedAt: now,
                })
                .where(and(
                    eq(dossierAssignments.id, assignment.id),
                    eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
                ))
                .returning();

            if (!assignmentRow) {
                throw httpError.conflict("Assignment is no longer in progress");
            }

            const [dossierRow] = await tx
                .update(dossiers)
                .set({
                    status: toStatus,
                    currentQcStep: 0,
                    currentMetadataKey: storedKey,
                    updatedAt: now,
                })
                .where(eq(dossiers.id, dossierId))
                .returning();

            // After resubmit, QC restarts at CHECKER_1. Reopen the rejector if they
            // were left REJECTED and no other CHECKER_1 assignment is already active.
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

            await tx.insert(workflowLogs).values({
                dossierId,
                actorId,
                action: "SUBMIT_ENTRY",
                fromStatus,
                toStatus,
            });

            return dossierRow;
        });

        const currentMetadataUrl = await buildLinkGet(storedKey);

        return {
            dossierId,
            assignmentId: assignment.id,
            currentMetadataKey: storedKey,
            currentMetadataUrl,
            dossierStatus: updatedDossier.status,
        };
    },

    async exportMetadataExcel(dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: eq(dossiers.id, dossierId),
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        if (!dossier.currentMetadataKey) {
            throw httpError.badRequest("Dossier has no current metadata");
        }

        const metadataKey = resolveMetadataJsonKey(dossier.currentMetadataKey);
        const rawMetadata = await downloadJsonFromStorage(metadataKey);

        if (!isDossierMetadata(rawMetadata)) {
            throw httpError.badRequest("Invalid metadata format");
        }

        const buffer = await buildMetadataExcel(rawMetadata);
        const baseName = rawMetadata.ho_so_id || dossier.name || dossierId;
        const filename = `${baseName.replace(/[^a-zA-Z0-9._-]/g, "_")}-metadata.xlsx`;

        return { buffer, filename };
    },
};
