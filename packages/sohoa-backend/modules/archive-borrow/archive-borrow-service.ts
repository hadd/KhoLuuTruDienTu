import { and, asc, desc, eq, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { httpError, AppError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    ArchiveBorrowAnnotationKind,
    ArchiveBorrowDipStatus,
    ArchiveBorrowItemKind,
    ArchiveBorrowMedium,
    ArchiveBorrowStatus,
    type ArchiveBorrowAnnotationBbox,
    type ArchiveBorrowAnnotationKindType,
} from "../../db/schemas/archive-borrow-constants.ts";
import {
    archiveBorrowAnnotations,
    archiveBorrowDipPackages,
    archiveBorrowItems,
    archiveBorrowReadingProgress,
    archiveBorrowRequests,
    type ArchiveBorrowAnnotation,
    type ArchiveBorrowDipPackage,
    type ArchiveBorrowItem,
    type ArchiveBorrowRequest,
} from "../../db/schemas/archive-borrow.ts";
import { ArchiveSubmissionStatus } from "../../db/schemas/archive-constants.ts";
import { archiveSubmissions } from "../../db/schemas/archive-submission.ts";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { logWarehouseAudit } from "../audit-log/warehouse-audit.ts";
import {
    assertDossierShareEligible,
    assertWarehouseDossierAccess,
    buildShareEligibleWhere,
    loadShareEligibleSecurityLevelIds,
    resolveWarehouseScope,
} from "../archive/archive-warehouse-service.ts";
import {
    generateBorrowDipPackage,
    revokeBorrowDipPackage,
    resolveBorrowDipPrefix,
} from "./archive-borrow-dip.ts";
import {
    downloadBinaryFromStorage,
    downloadJsonFromStorage,
} from "../data-entry/data-entry-s3-utils.ts";
import {
    hasArchiveBorrowRequestPermission,
    hasArchiveBorrowReviewPermission,
} from "./archive-borrow-permissions.ts";

export type CreateElectronicBorrowItemInput =
    | { itemKind: "FILE"; dossierId: string; fileId: string }
    | { itemKind: "DOSSIER"; dossierId: string };

export type CreateElectronicBorrowInput = {
    reason: string;
    requestedFrom: Date;
    requestedUntil: Date;
    items: CreateElectronicBorrowItemInput[];
};

export type ApproveElectronicBorrowInput = {
    approvedFrom: Date;
    approvedUntil: Date;
    reviewNotes?: string;
    placementId?: string;
};

function assertRequestPermission(profile: UserWithRoles) {
    if (!hasArchiveBorrowRequestPermission(profile)) {
        throw httpError.forbidden("archive.borrow.request required");
    }
}

function assertReviewPermission(profile: UserWithRoles) {
    if (!hasArchiveBorrowReviewPermission(profile)) {
        throw httpError.forbidden("archive.borrow.review required");
    }
}

function assertTimeRange(from: Date, until: Date, label: string) {
    if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
        throw httpError.badRequest(`${label} from is invalid`);
    }
    if (!(until instanceof Date) || Number.isNaN(until.getTime())) {
        throw httpError.badRequest(`${label} until is invalid`);
    }
    if (until.getTime() <= from.getTime()) {
        throw httpError.badRequest(`${label} until must be after from`);
    }
}

type BorrowItemWithLabels = ArchiveBorrowItem & {
    dossier?: { id?: string; name?: string | null; fondId?: string | null; dossierTypeId?: string | null } | null;
    file?: { id?: string; fileName?: string | null } | null;
};

function mapBorrowItems(items: BorrowItemWithLabels[]) {
    return items.map((item) => ({
        id: item.id,
        requestId: item.requestId,
        itemKind: item.itemKind,
        dossierId: item.dossierId,
        fileId: item.fileId,
        fileIdsSnapshot: item.fileIdsSnapshot,
        createdAt: item.createdAt,
        dossierName: item.dossier?.name ?? null,
        fileName: item.file?.fileName ?? null,
        fileCount:
            item.itemKind === ArchiveBorrowItemKind.DOSSIER
                ? (Array.isArray(item.fileIdsSnapshot) ? item.fileIdsSnapshot.length : 0)
                : null,
    }));
}

function mapRequestDetail(
    request: ArchiveBorrowRequest,
    items: BorrowItemWithLabels[],
    dipPackage: ArchiveBorrowDipPackage | null,
    requester?: { id: string; fullName: string | null; email: string | null } | null,
    reviewer?: { id: string; fullName: string | null; email: string | null } | null,
) {
    return {
        ...request,
        items: mapBorrowItems(items),
        dipPackage: dipPackage
            ? {
                id: dipPackage.id,
                status: dipPackage.status,
                layout: dipPackage.layout,
                manifest: dipPackage.manifest,
                hasWatermark: dipPackage.hasWatermark,
                generatedAt: dipPackage.generatedAt,
                revokedAt: dipPackage.revokedAt,
                errorMessage: dipPackage.errorMessage,
            }
            : null,
        requester: requester
            ? {
                id: requester.id,
                fullName: requester.fullName,
                email: requester.email,
            }
            : null,
        reviewer: reviewer
            ? {
                id: reviewer.id,
                fullName: reviewer.fullName,
                email: reviewer.email,
            }
            : null,
    };
}

const borrowItemRelations = {
    dossier: {
        columns: {
            id: true,
            name: true,
            fondId: true,
            dossierTypeId: true,
        },
    },
    file: {
        columns: {
            id: true,
            fileName: true,
        },
    },
} as const;

async function loadRequestBundle(requestId: string) {
    const request = await db.query.archiveBorrowRequests.findFirst({
        where: eq(archiveBorrowRequests.id, requestId),
        with: {
            items: {
                with: borrowItemRelations,
            },
            dipPackage: true,
            requester: {
                columns: { id: true, fullName: true, email: true },
            },
            reviewer: {
                columns: { id: true, fullName: true, email: true },
            },
        },
    });
    if (!request) {
        throw httpError.notFound("Borrow request not found");
    }
    return request;
}

async function markDipFailed(requestId: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await db
        .update(archiveBorrowDipPackages)
        .set({
            status: ArchiveBorrowDipStatus.FAILED,
            errorMessage: message,
            updatedAt: new Date(),
        })
        .where(eq(archiveBorrowDipPackages.requestId, requestId));
}

function startBorrowDipGeneration(options: {
    requestId: string;
    fileIds: string[];
    placementId?: string;
}) {
    void generateBorrowDipPackage(options).catch(async (err) => {
        logApi.error(
            { err, requestId: options.requestId },
            "[ArchiveBorrow] Background DIP generation failed",
        );
        try {
            await markDipFailed(options.requestId, err);
        } catch (updateErr) {
            logApi.error(
                { err: updateErr, requestId: options.requestId },
                "[ArchiveBorrow] Failed to mark DIP as FAILED",
            );
        }
    });
}

async function resolveElectronicFileIds(
    items: Array<{
        itemKind: string;
        dossierId: string;
        fileId: string | null;
        fileIdsSnapshot: string[] | null;
    }>,
): Promise<string[]> {
    const fileIds = new Set<string>();
    for (const item of items) {
        if (item.itemKind === ArchiveBorrowItemKind.FILE && item.fileId) {
            fileIds.add(item.fileId);
        } else if (
            item.itemKind === ArchiveBorrowItemKind.DOSSIER &&
            Array.isArray(item.fileIdsSnapshot)
        ) {
            for (const id of item.fileIdsSnapshot) {
                if (id) fileIds.add(id);
            }
        }
    }
    return [...fileIds];
}

async function assertActiveBorrowViewerAccess(
    profile: UserWithRoles,
    requestId: string,
) {
    assertRequestPermission(profile);
    const row = await loadRequestBundle(requestId);

    if (row.requesterId !== profile.id) {
        throw httpError.forbidden("Only the requester can view borrowed files");
    }
    if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
        throw httpError.badRequest("Only electronic borrow is supported");
    }

    const now = new Date();
    if (row.status !== ArchiveBorrowStatus.ACTIVE) {
        throw httpError.forbidden("Borrow request is not active");
    }
    if (!row.approvedUntil || now.getTime() >= row.approvedUntil.getTime()) {
        throw httpError.forbidden("Borrow window has expired");
    }
    if (row.approvedFrom && now.getTime() < row.approvedFrom.getTime()) {
        throw httpError.forbidden("Borrow window has not started");
    }

    return row;
}

/** Owner can read personal reader data even after EXPIRED (no PDF). */
async function assertBorrowReaderOwnerAccess(
    profile: UserWithRoles,
    requestId: string,
) {
    assertRequestPermission(profile);
    const row = await loadRequestBundle(requestId);

    if (row.requesterId !== profile.id) {
        throw httpError.forbidden("Only the requester can access reading data");
    }
    if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
        throw httpError.badRequest("Only electronic borrow is supported");
    }

    return row;
}

function assertBorrowActiveForWrite(
    row: Awaited<ReturnType<typeof loadRequestBundle>>,
) {
    const now = new Date();
    if (row.status !== ArchiveBorrowStatus.ACTIVE) {
        throw httpError.forbidden("Borrow request is not active");
    }
    if (!row.approvedUntil || now.getTime() >= row.approvedUntil.getTime()) {
        throw httpError.forbidden("Borrow window has expired");
    }
    if (row.approvedFrom && now.getTime() < row.approvedFrom.getTime()) {
        throw httpError.forbidden("Borrow window has not started");
    }
}

function assertFileBelongsToBorrow(
    row: Awaited<ReturnType<typeof loadRequestBundle>>,
    fileId: string,
) {
    const inManifest = (row.dipPackage?.manifest ?? []).some(
        (entry) => entry.fileId === fileId,
    );
    if (inManifest) return;

    for (const item of row.items) {
        if (item.fileId === fileId) return;
        if (
            Array.isArray(item.fileIdsSnapshot) &&
            item.fileIdsSnapshot.includes(fileId)
        ) {
            return;
        }
    }
    throw httpError.badRequest("File is not part of this borrow request");
}

function mapAnnotation(row: ArchiveBorrowAnnotation) {
    return {
        id: row.id,
        kind: row.kind,
        requestId: row.requestId,
        fileId: row.fileId,
        page: row.page,
        bbox: row.bbox,
        selectedText: row.selectedText,
        body: row.body,
        color: row.color,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function validateBbox(
    bbox: unknown,
): ArchiveBorrowAnnotationBbox | null {
    if (bbox == null) return null;
    if (
        !Array.isArray(bbox) ||
        bbox.length !== 4 ||
        bbox.some((n) => typeof n !== "number" || !Number.isFinite(n))
    ) {
        throw httpError.badRequest("bbox must be [x0, y0, x1, y1]");
    }
    return bbox as ArchiveBorrowAnnotationBbox;
}

async function loadArchiveYearsByDossierIds(
    dossierIds: string[],
): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>();
    if (dossierIds.length === 0) return result;

    const rows = await db
        .selectDistinctOn([archiveSubmissions.dossierId], {
            dossierId: archiveSubmissions.dossierId,
            inventoryId: sql<string | null>`${archiveSubmissions.fieldValues}->>'inventory'`,
        })
        .from(archiveSubmissions)
        .where(
            and(
                inArray(archiveSubmissions.dossierId, dossierIds),
                eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
            ),
        )
        .orderBy(
            archiveSubmissions.dossierId,
            desc(archiveSubmissions.reviewedAt),
        );

    const inventoryIds = [
        ...new Set(
            rows
                .map((row) => row.inventoryId?.trim())
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    const yearByInventoryId = new Map<string, number>();
    if (inventoryIds.length > 0) {
        const inventoryRows = await db
            .select({
                id: inventories.id,
                submissionYear: inventories.submissionYear,
            })
            .from(inventories)
            .where(inArray(inventories.id, inventoryIds));
        for (const row of inventoryRows) {
            yearByInventoryId.set(row.id, row.submissionYear);
        }
    }

    for (const row of rows) {
        const inventoryId = row.inventoryId?.trim();
        result.set(
            row.dossierId,
            inventoryId ? yearByInventoryId.get(inventoryId) ?? null : null,
        );
    }
    return result;
}

function normalizeMetadataObjectKey(rawKey: string | null | undefined): string | null {
    if (!rawKey?.trim()) return null;
    const key = rawKey.trim();
    return key.endsWith(".json") ? key : `${key}.json`;
}

export const ArchiveBorrowService = {
    async createElectronicRequest(
        profile: UserWithRoles,
        input: CreateElectronicBorrowInput,
    ) {
        assertRequestPermission(profile);
        assertTimeRange(input.requestedFrom, input.requestedUntil, "requested");

        if (!input.items?.length) {
            throw httpError.badRequest("At least one item is required");
        }
        if (!input.reason?.trim()) {
            throw httpError.badRequest("reason is required");
        }

        const dossierIds = [...new Set(input.items.map((i) => i.dossierId))];
        const dossiersRows = await db.query.dossiers.findMany({
            where: activeDossierWhere(inArray(dossiers.id, dossierIds)),
            columns: {
                id: true,
                name: true,
                status: true,
                fondId: true,
                dossierTypeId: true,
                securityLevelId: true,
            },
            with: {
                files: {
                    columns: { id: true, dossierId: true, fileName: true },
                },
            },
        });
        const dossierMap = new Map(dossiersRows.map((d) => [d.id, d]));

        for (const dossierId of dossierIds) {
            const dossier = dossierMap.get(dossierId);
            if (!dossier) {
                throw httpError.notFound(`Dossier not found: ${dossierId}`);
            }
            if (dossier.status !== DossierStatus.ARCHIVED) {
                throw httpError.badRequest(
                    `Dossier must be archived before borrowing: ${dossierId}`,
                );
            }
            await assertDossierShareEligible(dossier.securityLevelId);
        }

        const preparedItems: Array<{
            itemKind: typeof ArchiveBorrowItemKind.FILE | typeof ArchiveBorrowItemKind.DOSSIER;
            dossierId: string;
            fileId: string | null;
            fileIdsSnapshot: string[] | null;
        }> = [];

        for (const item of input.items) {
            const dossier = dossierMap.get(item.dossierId)!;
            if (item.itemKind === "FILE") {
                const file = dossier.files.find((f) => f.id === item.fileId);
                if (!file) {
                    throw httpError.badRequest(
                        `File ${item.fileId} does not belong to dossier ${item.dossierId}`,
                    );
                }
                preparedItems.push({
                    itemKind: ArchiveBorrowItemKind.FILE,
                    dossierId: item.dossierId,
                    fileId: item.fileId,
                    fileIdsSnapshot: null,
                });
            } else if (item.itemKind === "DOSSIER") {
                const snapshot = dossier.files.map((f) => f.id);
                if (snapshot.length === 0) {
                    throw httpError.badRequest(
                        `Dossier has no files to borrow: ${item.dossierId}`,
                    );
                }
                preparedItems.push({
                    itemKind: ArchiveBorrowItemKind.DOSSIER,
                    dossierId: item.dossierId,
                    fileId: null,
                    fileIdsSnapshot: snapshot,
                });
            } else {
                throw httpError.badRequest("Invalid item kind for electronic borrow");
            }
        }

        const created = await db.transaction(async (tx) => {
            const [request] = await tx
                .insert(archiveBorrowRequests)
                .values({
                    medium: ArchiveBorrowMedium.ELECTRONIC,
                    requesterId: profile.id,
                    reason: input.reason.trim(),
                    status: ArchiveBorrowStatus.PENDING,
                    requestedFrom: input.requestedFrom,
                    requestedUntil: input.requestedUntil,
                })
                .returning();

            if (!request) {
                throw httpError.internalServerError("Failed to create borrow request");
            }

            const items = await tx
                .insert(archiveBorrowItems)
                .values(
                    preparedItems.map((item) => ({
                        requestId: request.id,
                        itemKind: item.itemKind,
                        dossierId: item.dossierId,
                        fileId: item.fileId,
                        fileIdsSnapshot: item.fileIdsSnapshot,
                    })),
                )
                .returning();

            return { request, items };
        });

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "request_borrow",
            summary: `Tạo phiếu mượn điện tử ${created.request.id}`,
            entityType: "archive_borrow_request",
            entityId: created.request.id,
            details: {
                itemCount: created.items.length,
                requestedFrom: input.requestedFrom.toISOString(),
                requestedUntil: input.requestedUntil.toISOString(),
            },
        });

        const labeledItems: BorrowItemWithLabels[] = created.items.map((item) => {
            const dossier = dossierMap.get(item.dossierId);
            const file = item.fileId
                ? dossier?.files.find((f) => f.id === item.fileId)
                : undefined;
            return {
                ...item,
                dossier: dossier
                    ? {
                        id: dossier.id,
                        name: dossier.name,
                        fondId: dossier.fondId,
                        dossierTypeId: dossier.dossierTypeId,
                    }
                    : null,
                file: file
                    ? { id: file.id, fileName: file.fileName }
                    : null,
            };
        });

        return mapRequestDetail(created.request, labeledItems, null, {
            id: profile.id,
            fullName: profile.fullName ?? null,
            email: profile.email ?? null,
        }, null);
    },

    /**
     * Metadata-only search for ARCHIVED dossiers whose security level allows
     * share. Does not enforce warehouse fond ACL. Does not return file content/paths.
     */
    async searchEligibleDossiers(
        profile: UserWithRoles,
        options: { q: string; limit?: number },
    ) {
        assertRequestPermission(profile);
        const q = options.q?.trim() ?? "";
        if (q.length < 2) {
            throw httpError.badRequest("q must be at least 2 characters");
        }
        const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
        const pattern = `%${q}%`;

        const eligibleInfo = await loadShareEligibleSecurityLevelIds();
        const shareEligibleWhere = buildShareEligibleWhere(eligibleInfo);

        const rows = await db.query.dossiers.findMany({
            where: activeDossierWhere(
                eq(dossiers.status, DossierStatus.ARCHIVED),
                shareEligibleWhere,
                or(
                    ilike(dossiers.name, pattern),
                    ilike(dossiers.folderPath, pattern),
                ),
            ),
            columns: {
                id: true,
                name: true,
                folderPath: true,
                status: true,
                fondId: true,
                securityLevelId: true,
            },
            with: {
                files: {
                    columns: {
                        id: true,
                        fileName: true,
                    },
                },
            },
            orderBy: [desc(dossiers.updatedAt)],
            limit,
        });

        const levelIds = [
            ...new Set(
                rows
                    .map((row) => row.securityLevelId)
                    .filter((id): id is string => Boolean(id)),
            ),
        ];
        const levelNameById = new Map<string, string>();
        if (levelIds.length > 0) {
            const levels = await db
                .select({ id: securityLevels.id, name: securityLevels.name })
                .from(securityLevels)
                .where(
                    and(
                        inArray(securityLevels.id, levelIds),
                        isNull(securityLevels.deletedAt),
                    ),
                );
            for (const level of levels) {
                levelNameById.set(level.id, level.name);
            }
        }

        return rows.map((row) => {
            const files = [...row.files].sort((a, b) =>
                a.fileName.localeCompare(b.fileName),
            );
            return {
                id: row.id,
                name: row.name,
                folderPath: row.folderPath,
                status: row.status,
                fondId: row.fondId,
                securityLevelId: row.securityLevelId,
                securityLevelName: row.securityLevelId
                    ? (levelNameById.get(row.securityLevelId) ?? null)
                    : null,
                fileCount: files.length,
                files: files.map((f) => ({
                    id: f.id,
                    fileName: f.fileName,
                })),
            };
        });
    },

    async listMine(profile: UserWithRoles, options?: {
        page?: number;
        limit?: number;
        search?: string;
    }) {
        assertRequestPermission(profile);
        const page = Math.max(1, options?.page ?? 1);
        const limit = Math.min(Math.max(options?.limit ?? 10, 1), 100);
        const offset = (page - 1) * limit;
        const searchTerm = options?.search?.trim();

        const whereClause = and(
            eq(archiveBorrowRequests.requesterId, profile.id),
            eq(archiveBorrowRequests.medium, ArchiveBorrowMedium.ELECTRONIC),
            ...(searchTerm
                ? [ilike(archiveBorrowRequests.reason, `%${searchTerm}%`)]
                : []),
        );

        const [rows, countRows] = await Promise.all([
            db.query.archiveBorrowRequests.findMany({
                where: whereClause,
                with: {
                    items: {
                        with: borrowItemRelations,
                    },
                    dipPackage: true,
                },
                orderBy: [desc(archiveBorrowRequests.createdAt)],
                limit,
                offset,
            }),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(archiveBorrowRequests)
                .where(whereClause),
        ]);

        const total = countRows[0]?.count ?? 0;
        return {
            items: rows.map((row) =>
                mapRequestDetail(row, row.items, row.dipPackage ?? null)
            ),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    },

    async listPending(profile: UserWithRoles, options?: { limit?: number; offset?: number }) {
        assertReviewPermission(profile);
        const { scope } = await resolveWarehouseScope(profile);
        const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
        const offset = Math.max(options?.offset ?? 0, 0);

        const rows = await db.query.archiveBorrowRequests.findMany({
            where: and(
                eq(archiveBorrowRequests.medium, ArchiveBorrowMedium.ELECTRONIC),
                eq(archiveBorrowRequests.status, ArchiveBorrowStatus.PENDING),
            ),
            with: {
                items: {
                    with: borrowItemRelations,
                },
                dipPackage: true,
                requester: {
                    columns: { id: true, fullName: true, email: true },
                },
            },
            orderBy: [desc(archiveBorrowRequests.createdAt)],
            limit: limit * 3,
            offset,
        });

        const filtered = rows.filter((row) =>
            row.items.every((item) => {
                try {
                    assertWarehouseDossierAccess(scope, {
                        fondId: item.dossier?.fondId,
                        dossierTypeId: item.dossier?.dossierTypeId,
                    });
                    return true;
                } catch {
                    return false;
                }
            })
        ).slice(0, limit);

        return filtered.map((row) =>
            mapRequestDetail(
                row,
                row.items,
                row.dipPackage ?? null,
                row.requester,
                null,
            )
        );
    },

    async getById(profile: UserWithRoles, requestId: string) {
        const row = await loadRequestBundle(requestId);
        const isOwner = row.requesterId === profile.id;
        const canReview = hasArchiveBorrowReviewPermission(profile);

        if (!isOwner && !canReview) {
            throw httpError.forbidden("Not allowed to view this borrow request");
        }

        if (canReview && !isOwner) {
            const { scope } = await resolveWarehouseScope(profile);
            const dossierRows = await db.query.dossiers.findMany({
                where: inArray(
                    dossiers.id,
                    row.items.map((i) => i.dossierId),
                ),
                columns: { id: true, fondId: true, dossierTypeId: true },
            });
            for (const dossier of dossierRows) {
                assertWarehouseDossierAccess(scope, dossier);
            }
        }

        if (isOwner && !hasArchiveBorrowRequestPermission(profile) && !canReview) {
            throw httpError.forbidden("archive.borrow.request required");
        }

        return mapRequestDetail(
            row,
            row.items,
            row.dipPackage ?? null,
            row.requester,
            row.reviewer,
        );
    },

    async approve(
        profile: UserWithRoles,
        requestId: string,
        input: ApproveElectronicBorrowInput,
    ) {
        assertReviewPermission(profile);
        assertTimeRange(input.approvedFrom, input.approvedUntil, "approved");

        const row = await loadRequestBundle(requestId);
        if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
            throw httpError.badRequest("Only electronic borrow is supported");
        }
        if (row.status !== ArchiveBorrowStatus.PENDING) {
            throw httpError.badRequest("Only pending requests can be approved");
        }

        const { scope } = await resolveWarehouseScope(profile);
        const dossierRows = await db.query.dossiers.findMany({
            where: inArray(
                dossiers.id,
                row.items.map((i) => i.dossierId),
            ),
            columns: { id: true, fondId: true, dossierTypeId: true, status: true },
        });
        for (const dossier of dossierRows) {
            assertWarehouseDossierAccess(scope, dossier);
            if (dossier.status !== DossierStatus.ARCHIVED) {
                throw httpError.badRequest(`Dossier is not archived: ${dossier.id}`);
            }
        }

        const now = new Date();
        const updated = await db
            .update(archiveBorrowRequests)
            .set({
                status: ArchiveBorrowStatus.APPROVED,
                approvedFrom: input.approvedFrom,
                approvedUntil: input.approvedUntil,
                reviewedBy: profile.id,
                reviewedAt: now,
                reviewNotes: input.reviewNotes?.trim() || null,
                updatedAt: now,
            })
            .where(
                and(
                    eq(archiveBorrowRequests.id, requestId),
                    eq(archiveBorrowRequests.status, ArchiveBorrowStatus.PENDING),
                ),
            )
            .returning();

        if (!updated[0]) {
            throw httpError.conflict("Request was already reviewed");
        }

        await db.insert(archiveBorrowDipPackages).values({
            requestId,
            status: ArchiveBorrowDipStatus.PENDING,
        });

        const fileIds = await resolveElectronicFileIds(row.items);
        startBorrowDipGeneration({
            requestId,
            fileIds,
            placementId: input.placementId,
        });

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "approve_borrow",
            summary: `Duyệt phiếu mượn ${requestId}`,
            entityType: "archive_borrow_request",
            entityId: requestId,
            details: {
                approvedFrom: input.approvedFrom.toISOString(),
                approvedUntil: input.approvedUntil.toISOString(),
            },
        });

        return await this.getById(profile, requestId);
    },

    async regenerateDip(
        profile: UserWithRoles,
        requestId: string,
        input?: { placementId?: string },
    ) {
        const row = await loadRequestBundle(requestId);
        if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
            throw httpError.badRequest("Only electronic borrow is supported");
        }
        if (row.status !== ArchiveBorrowStatus.APPROVED) {
            throw httpError.badRequest(
                "Only approved requests with a failed DIP can be regenerated",
            );
        }

        const isOwner = row.requesterId === profile.id;
        const canReview = hasArchiveBorrowReviewPermission(profile);
        const canRequest = hasArchiveBorrowRequestPermission(profile);
        if (!canReview && !(isOwner && canRequest)) {
            throw httpError.forbidden(
                "archive.borrow.review or owner with archive.borrow.request required",
            );
        }

        if (canReview) {
            const { scope } = await resolveWarehouseScope(profile);
            const dossierRows = await db.query.dossiers.findMany({
                where: inArray(
                    dossiers.id,
                    row.items.map((i) => i.dossierId),
                ),
                columns: { id: true, fondId: true, dossierTypeId: true, status: true },
            });
            for (const dossier of dossierRows) {
                assertWarehouseDossierAccess(scope, dossier);
            }
        }

        const dip = row.dipPackage;
        if (!dip) {
            await db.insert(archiveBorrowDipPackages).values({
                requestId,
                status: ArchiveBorrowDipStatus.PENDING,
            });
        } else if (
            dip.status === ArchiveBorrowDipStatus.FAILED ||
            dip.status === ArchiveBorrowDipStatus.PENDING
        ) {
            await db
                .update(archiveBorrowDipPackages)
                .set({
                    status: ArchiveBorrowDipStatus.PENDING,
                    errorMessage: null,
                    manifest: [],
                    storageKey: null,
                    checksum: null,
                    byteSize: null,
                    generatedAt: null,
                    revokedAt: null,
                    updatedAt: new Date(),
                })
                .where(eq(archiveBorrowDipPackages.requestId, requestId));
        } else if (dip.status === ArchiveBorrowDipStatus.READY) {
            throw httpError.badRequest("DIP package is already ready");
        } else if (dip.status === ArchiveBorrowDipStatus.REVOKED) {
            throw httpError.badRequest(
                "DIP package was revoked; create a new borrow request",
            );
        }

        const fileIds = await resolveElectronicFileIds(row.items);
        try {
            await generateBorrowDipPackage({
                requestId,
                fileIds,
                placementId: input?.placementId,
            });
        } catch (err) {
            await markDipFailed(requestId, err);
        }

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "regenerate_borrow_dip",
            summary: `Tạo lại DIP phiếu mượn ${requestId}`,
            entityType: "archive_borrow_request",
            entityId: requestId,
        });

        return await this.getById(profile, requestId);
    },

    async reject(
        profile: UserWithRoles,
        requestId: string,
        input: { reviewNotes: string },
    ) {
        assertReviewPermission(profile);
        if (!input.reviewNotes?.trim()) {
            throw httpError.badRequest("reviewNotes is required");
        }

        const row = await loadRequestBundle(requestId);
        if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
            throw httpError.badRequest("Only electronic borrow is supported");
        }
        if (row.status !== ArchiveBorrowStatus.PENDING) {
            throw httpError.badRequest("Only pending requests can be rejected");
        }

        const { scope } = await resolveWarehouseScope(profile);
        const dossierRows = await db.query.dossiers.findMany({
            where: inArray(
                dossiers.id,
                row.items.map((i) => i.dossierId),
            ),
            columns: { id: true, fondId: true, dossierTypeId: true },
        });
        for (const dossier of dossierRows) {
            assertWarehouseDossierAccess(scope, dossier);
        }

        const now = new Date();
        const updated = await db
            .update(archiveBorrowRequests)
            .set({
                status: ArchiveBorrowStatus.REJECTED,
                reviewedBy: profile.id,
                reviewedAt: now,
                reviewNotes: input.reviewNotes.trim(),
                updatedAt: now,
            })
            .where(
                and(
                    eq(archiveBorrowRequests.id, requestId),
                    eq(archiveBorrowRequests.status, ArchiveBorrowStatus.PENDING),
                ),
            )
            .returning();

        if (!updated[0]) {
            throw httpError.conflict("Request was already reviewed");
        }

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "reject_borrow",
            summary: `Từ chối phiếu mượn ${requestId}`,
            entityType: "archive_borrow_request",
            entityId: requestId,
        });

        return await this.getById(profile, requestId);
    },

    async activate(profile: UserWithRoles, requestId: string) {
        assertRequestPermission(profile);
        const row = await loadRequestBundle(requestId);

        if (row.requesterId !== profile.id) {
            throw httpError.forbidden("Only the requester can activate this request");
        }
        if (row.medium !== ArchiveBorrowMedium.ELECTRONIC) {
            throw httpError.badRequest("Only electronic borrow is supported");
        }
        if (row.status !== ArchiveBorrowStatus.APPROVED) {
            throw httpError.badRequest("Only approved requests can be activated");
        }
        if (!row.approvedFrom || !row.approvedUntil) {
            throw httpError.badRequest("Approved time window is missing");
        }

        const now = new Date();
        if (now.getTime() < row.approvedFrom.getTime()) {
            throw httpError.badRequest("Borrow window has not started yet");
        }
        if (now.getTime() >= row.approvedUntil.getTime()) {
            throw httpError.badRequest("Borrow window has already ended");
        }

        const dip = row.dipPackage;
        if (!dip || dip.status !== ArchiveBorrowDipStatus.READY) {
            throw httpError.badRequest("DIP package is not ready");
        }

        const updated = await db
            .update(archiveBorrowRequests)
            .set({
                status: ArchiveBorrowStatus.ACTIVE,
                activatedAt: now,
                activatedBy: profile.id,
                updatedAt: now,
            })
            .where(
                and(
                    eq(archiveBorrowRequests.id, requestId),
                    eq(archiveBorrowRequests.status, ArchiveBorrowStatus.APPROVED),
                ),
            )
            .returning();

        if (!updated[0]) {
            throw httpError.conflict("Request could not be activated");
        }

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "activate_borrow",
            summary: `Kích hoạt xem phiếu mượn ${requestId}`,
            entityType: "archive_borrow_request",
            entityId: requestId,
        });

        return await this.getById(profile, requestId);
    },

    async getViewModel(profile: UserWithRoles, requestId: string) {
        const row = await assertActiveBorrowViewerAccess(profile, requestId);
        const dip = row.dipPackage;
        if (!dip || dip.status !== ArchiveBorrowDipStatus.READY) {
            throw httpError.badRequest("DIP package is not ready");
        }

        const dossierIds = [
            ...new Set(row.items.map((item) => item.dossierId).filter(Boolean)),
        ];
        if (dossierIds.length === 0) {
            return {
                requestId: row.id,
                status: row.status,
                approvedFrom: row.approvedFrom,
                approvedUntil: row.approvedUntil,
                dipStatus: dip.status,
                dossiers: [],
            };
        }

        const dossierItemKinds = new Map<string, Set<"FILE" | "DOSSIER">>();
        const fileItemKindById = new Map<string, "FILE" | "DOSSIER">();
        for (const item of row.items) {
            const kinds = dossierItemKinds.get(item.dossierId) ?? new Set();
            if (
                item.itemKind === ArchiveBorrowItemKind.FILE ||
                item.itemKind === ArchiveBorrowItemKind.DOSSIER
            ) {
                kinds.add(item.itemKind);
            }
            dossierItemKinds.set(item.dossierId, kinds);

            if (item.itemKind === ArchiveBorrowItemKind.FILE && item.fileId) {
                fileItemKindById.set(item.fileId, "FILE");
            } else if (
                item.itemKind === ArchiveBorrowItemKind.DOSSIER &&
                Array.isArray(item.fileIdsSnapshot)
            ) {
                for (const fileId of item.fileIdsSnapshot) {
                    if (fileId && !fileItemKindById.has(fileId)) {
                        fileItemKindById.set(fileId, "DOSSIER");
                    }
                }
            }
        }

        const [dossierRows, archiveYears] = await Promise.all([
            db
                .select({
                    id: dossiers.id,
                    name: dossiers.name,
                    folderPath: dossiers.folderPath,
                    status: dossiers.status,
                    archiveStorageState: dossiers.archiveStorageState,
                    fondId: dossiers.fondId,
                    fondName: fonds.fondName,
                    dossierTypeId: dossiers.dossierTypeId,
                    dossierTypeName: dossierTypes.name,
                })
                .from(dossiers)
                .leftJoin(
                    fonds,
                    and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
                )
                .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
                .where(activeDossierWhere(inArray(dossiers.id, dossierIds))),
            loadArchiveYearsByDossierIds(dossierIds),
        ]);

        const dossierById = new Map(dossierRows.map((d) => [d.id, d]));
        const manifest = dip.manifest ?? [];
        const fileIds = [...new Set(manifest.map((m) => m.fileId).filter(Boolean))];

        const fileMetaById = new Map<
            string,
            {
                filePath: string;
                documentTypeId: string | null;
                documentTypeName: string | null;
            }
        >();
        if (fileIds.length > 0) {
            const fileRows = await db
                .select({
                    id: dossierFiles.id,
                    filePath: dossierFiles.filePath,
                    documentTypeId: dossierFiles.documentTypeId,
                    documentTypeName: documentTypes.name,
                })
                .from(dossierFiles)
                .leftJoin(
                    documentTypes,
                    eq(documentTypes.id, dossierFiles.documentTypeId),
                )
                .where(inArray(dossierFiles.id, fileIds));
            for (const file of fileRows) {
                fileMetaById.set(file.id, {
                    filePath: file.filePath,
                    documentTypeId: file.documentTypeId,
                    documentTypeName: file.documentTypeName ?? null,
                });
            }
        }

        const dossiersView = dossierIds.map((dossierId) => {
            const dossier = dossierById.get(dossierId);
            const files = manifest
                .filter((entry) => entry.dossierId === dossierId)
                .map((entry) => {
                    const meta = fileMetaById.get(entry.fileId);
                    return {
                        fileId: entry.fileId,
                        fileName: entry.fileName,
                        filePath: meta?.filePath ?? null,
                        documentTypeId: meta?.documentTypeId ?? null,
                        documentTypeName: meta?.documentTypeName ?? null,
                        itemKind: fileItemKindById.get(entry.fileId) ?? "DOSSIER",
                    };
                });

            return {
                id: dossierId,
                name: dossier?.name ?? dossierId,
                folderPath: dossier?.folderPath ?? null,
                status: dossier?.status ?? null,
                archiveStorageState: dossier?.archiveStorageState ?? null,
                fondId: dossier?.fondId ?? null,
                fondName: dossier?.fondName ?? null,
                dossierTypeId: dossier?.dossierTypeId ?? null,
                dossierTypeName: dossier?.dossierTypeName ?? null,
                archiveYear: archiveYears.get(dossierId) ?? null,
                itemKinds: [...(dossierItemKinds.get(dossierId) ?? [])],
                files,
            };
        });

        return {
            requestId: row.id,
            status: row.status,
            approvedFrom: row.approvedFrom,
            approvedUntil: row.approvedUntil,
            dipStatus: dip.status,
            dossiers: dossiersView,
        };
    },

    async getDossierMetadata(
        profile: UserWithRoles,
        requestId: string,
        dossierId: string,
    ) {
        const row = await assertActiveBorrowViewerAccess(profile, requestId);

        const belongs = row.items.some((item) => item.dossierId === dossierId);
        if (!belongs) {
            throw httpError.forbidden("Dossier is not part of this borrow request");
        }

        const [dossier] = await db
            .select({
                id: dossiers.id,
                currentMetadataKey: dossiers.currentMetadataKey,
                ocrMetadataKey: dossiers.ocrMetadataKey,
            })
            .from(dossiers)
            .where(activeDossierWhere(eq(dossiers.id, dossierId)))
            .limit(1);

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const metadataKey = normalizeMetadataObjectKey(
            dossier.currentMetadataKey ?? dossier.ocrMetadataKey,
        );
        if (!metadataKey) {
            return { dossierId, metadata: null };
        }

        try {
            const metadata = await downloadJsonFromStorage(metadataKey);
            return { dossierId, metadata };
        } catch (error) {
            if (error instanceof AppError && error.status === 404) {
                return { dossierId, metadata: null };
            }
            throw error;
        }
    },

    async getDipFileContent(
        profile: UserWithRoles,
        requestId: string,
        fileId: string,
    ): Promise<{
        bytes: Uint8Array;
        fileId: string;
        fileName: string;
        approvedUntil: Date;
    }> {
        const row = await assertActiveBorrowViewerAccess(profile, requestId);

        const dip = row.dipPackage;
        if (!dip || dip.status !== ArchiveBorrowDipStatus.READY) {
            throw httpError.badRequest("DIP package is not ready");
        }

        const entry = (dip.manifest ?? []).find((m) => m.fileId === fileId);
        if (!entry?.objectKey) {
            throw httpError.notFound("File not found in DIP package");
        }

        // Guard: object must live under DIP prefix, never AIP.
        const dipPrefix = `${resolveBorrowDipPrefix()}/`;
        if (
            entry.objectKey.includes("/aip/") ||
            entry.objectKey.startsWith("aip/") ||
            !entry.objectKey.startsWith(dipPrefix)
        ) {
            throw httpError.forbidden("AIP access is not allowed for borrow viewing");
        }

        const bytes = await downloadBinaryFromStorage(entry.objectKey);

        logWarehouseAudit({
            userId: profile.id,
            module: "archive-borrow",
            eventType: "view_borrow_document",
            summary: `Xem DIP file ${fileId} của phiếu ${requestId}`,
            entityType: "archive_borrow_request",
            entityId: requestId,
            details: { fileId, byteSize: bytes.byteLength },
        });

        return {
            bytes,
            fileId: entry.fileId,
            fileName: entry.fileName,
            approvedUntil: row.approvedUntil!,
        };
    },

    async getReadingProgress(
        profile: UserWithRoles,
        requestId: string,
        fileId?: string,
    ) {
        await assertBorrowReaderOwnerAccess(profile, requestId);

        const conditions = [
            eq(archiveBorrowReadingProgress.userId, profile.id),
            eq(archiveBorrowReadingProgress.requestId, requestId),
        ];
        if (fileId) {
            conditions.push(eq(archiveBorrowReadingProgress.fileId, fileId));
        }

        const rows = await db
            .select()
            .from(archiveBorrowReadingProgress)
            .where(and(...conditions))
            .orderBy(desc(archiveBorrowReadingProgress.updatedAt));

        return rows.map((row) => ({
            id: row.id,
            requestId: row.requestId,
            fileId: row.fileId,
            page: row.page,
            updatedAt: row.updatedAt,
        }));
    },

    async upsertReadingProgress(
        profile: UserWithRoles,
        requestId: string,
        input: { fileId: string; page: number },
    ) {
        const row = await assertBorrowReaderOwnerAccess(profile, requestId);
        assertBorrowActiveForWrite(row);
        assertFileBelongsToBorrow(row, input.fileId);

        const page = Math.max(1, Math.floor(input.page));
        const now = new Date();

        const [saved] = await db
            .insert(archiveBorrowReadingProgress)
            .values({
                userId: profile.id,
                requestId,
                fileId: input.fileId,
                page,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [
                    archiveBorrowReadingProgress.userId,
                    archiveBorrowReadingProgress.requestId,
                    archiveBorrowReadingProgress.fileId,
                ],
                set: {
                    page,
                    updatedAt: now,
                },
            })
            .returning();

        return {
            id: saved.id,
            requestId: saved.requestId,
            fileId: saved.fileId,
            page: saved.page,
            updatedAt: saved.updatedAt,
        };
    },

    async listAnnotations(
        profile: UserWithRoles,
        requestId: string,
        options?: { fileId?: string; kind?: ArchiveBorrowAnnotationKindType },
    ) {
        await assertBorrowReaderOwnerAccess(profile, requestId);

        const conditions = [
            eq(archiveBorrowAnnotations.userId, profile.id),
            eq(archiveBorrowAnnotations.requestId, requestId),
            ne(archiveBorrowAnnotations.kind, ArchiveBorrowAnnotationKind.HIGHLIGHT),
        ];
        if (options?.fileId) {
            conditions.push(eq(archiveBorrowAnnotations.fileId, options.fileId));
        }
        if (options?.kind) {
            if (options.kind === ArchiveBorrowAnnotationKind.HIGHLIGHT) {
                return [];
            }
            conditions.push(eq(archiveBorrowAnnotations.kind, options.kind));
        }

        const rows = await db
            .select()
            .from(archiveBorrowAnnotations)
            .where(and(...conditions))
            .orderBy(
                asc(archiveBorrowAnnotations.page),
                desc(archiveBorrowAnnotations.createdAt),
            );

        return rows.map(mapAnnotation);
    },

    async createAnnotation(
        profile: UserWithRoles,
        requestId: string,
        input: {
            kind: ArchiveBorrowAnnotationKindType;
            fileId: string;
            page: number;
            bbox?: ArchiveBorrowAnnotationBbox | null;
            selectedText?: string | null;
            body?: string | null;
            color?: string | null;
        },
    ) {
        const row = await assertBorrowReaderOwnerAccess(profile, requestId);
        assertBorrowActiveForWrite(row);
        assertFileBelongsToBorrow(row, input.fileId);

        if (input.kind === ArchiveBorrowAnnotationKind.HIGHLIGHT) {
            throw httpError.badRequest("HIGHLIGHT annotations are no longer supported");
        }

        if (
            input.kind !== ArchiveBorrowAnnotationKind.BOOKMARK &&
            input.kind !== ArchiveBorrowAnnotationKind.NOTE
        ) {
            throw httpError.badRequest("Invalid annotation kind");
        }

        const page = Math.max(1, Math.floor(input.page));
        const bbox = validateBbox(input.bbox ?? null);

        const [created] = await db
            .insert(archiveBorrowAnnotations)
            .values({
                kind: input.kind,
                userId: profile.id,
                requestId,
                fileId: input.fileId,
                page,
                bbox,
                selectedText: input.selectedText?.trim() || null,
                body: input.body?.trim() || null,
                color: input.color?.trim() || null,
            })
            .returning();

        return mapAnnotation(created);
    },

    async updateAnnotation(
        profile: UserWithRoles,
        requestId: string,
        annotationId: string,
        input: {
            page?: number;
            bbox?: ArchiveBorrowAnnotationBbox | null;
            selectedText?: string | null;
            body?: string | null;
            color?: string | null;
        },
    ) {
        const row = await assertBorrowReaderOwnerAccess(profile, requestId);
        assertBorrowActiveForWrite(row);

        const existing = await db.query.archiveBorrowAnnotations.findFirst({
            where: and(
                eq(archiveBorrowAnnotations.id, annotationId),
                eq(archiveBorrowAnnotations.requestId, requestId),
                eq(archiveBorrowAnnotations.userId, profile.id),
                ne(archiveBorrowAnnotations.kind, ArchiveBorrowAnnotationKind.HIGHLIGHT),
            ),
        });
        if (!existing) {
            throw httpError.notFound("Annotation not found");
        }

        const patch: Partial<typeof archiveBorrowAnnotations.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (input.page != null) {
            patch.page = Math.max(1, Math.floor(input.page));
        }
        if (input.bbox !== undefined) {
            patch.bbox = validateBbox(input.bbox);
        }
        if (input.selectedText !== undefined) {
            patch.selectedText = input.selectedText?.trim() || null;
        }
        if (input.body !== undefined) {
            patch.body = input.body?.trim() || null;
        }
        if (input.color !== undefined) {
            patch.color = input.color?.trim() || null;
        }

        const [updated] = await db
            .update(archiveBorrowAnnotations)
            .set(patch)
            .where(eq(archiveBorrowAnnotations.id, annotationId))
            .returning();

        return mapAnnotation(updated);
    },

    async deleteAnnotation(
        profile: UserWithRoles,
        requestId: string,
        annotationId: string,
    ) {
        const row = await assertBorrowReaderOwnerAccess(profile, requestId);
        assertBorrowActiveForWrite(row);

        const deleted = await db
            .delete(archiveBorrowAnnotations)
            .where(
                and(
                    eq(archiveBorrowAnnotations.id, annotationId),
                    eq(archiveBorrowAnnotations.requestId, requestId),
                    eq(archiveBorrowAnnotations.userId, profile.id),
                    ne(archiveBorrowAnnotations.kind, ArchiveBorrowAnnotationKind.HIGHLIGHT),
                ),
            )
            .returning({ id: archiveBorrowAnnotations.id });

        if (deleted.length === 0) {
            throw httpError.notFound("Annotation not found");
        }

        return { id: deleted[0].id };
    },

    async getReadingSummary(profile: UserWithRoles) {
        assertRequestPermission(profile);

        const requests = await db.query.archiveBorrowRequests.findMany({
            where: and(
                eq(archiveBorrowRequests.requesterId, profile.id),
                eq(archiveBorrowRequests.medium, ArchiveBorrowMedium.ELECTRONIC),
            ),
            with: {
                items: true,
                dipPackage: true,
            },
            orderBy: [desc(archiveBorrowRequests.updatedAt)],
            limit: 100,
        });

        if (requests.length === 0) {
            return { currentlyReading: [], saved: [] };
        }

        const requestIds = requests.map((r) => r.id);

        const [progressRows, annotationRows] = await Promise.all([
            db
                .select()
                .from(archiveBorrowReadingProgress)
                .where(
                    and(
                        eq(archiveBorrowReadingProgress.userId, profile.id),
                        inArray(archiveBorrowReadingProgress.requestId, requestIds),
                    ),
                )
                .orderBy(desc(archiveBorrowReadingProgress.updatedAt)),
            db
                .select()
                .from(archiveBorrowAnnotations)
                .where(
                    and(
                        eq(archiveBorrowAnnotations.userId, profile.id),
                        inArray(archiveBorrowAnnotations.requestId, requestIds),
                    ),
                )
                .orderBy(desc(archiveBorrowAnnotations.updatedAt)),
        ]);

        const fileNameById = new Map<string, string>();
        for (const req of requests) {
            for (const entry of req.dipPackage?.manifest ?? []) {
                fileNameById.set(entry.fileId, entry.fileName);
            }
        }

        const latestProgressByRequest = new Map<
            string,
            (typeof progressRows)[number]
        >();
        for (const progress of progressRows) {
            if (!latestProgressByRequest.has(progress.requestId)) {
                latestProgressByRequest.set(progress.requestId, progress);
            }
        }

        const annotationStatsByRequest = new Map<
            string,
            { bookmarkCount: number; noteCount: number }
        >();
        for (const annotation of annotationRows) {
            if (annotation.kind === ArchiveBorrowAnnotationKind.HIGHLIGHT) {
                continue;
            }
            const stats = annotationStatsByRequest.get(annotation.requestId) ?? {
                bookmarkCount: 0,
                noteCount: 0,
            };
            if (annotation.kind === ArchiveBorrowAnnotationKind.BOOKMARK) {
                stats.bookmarkCount += 1;
            } else if (annotation.kind === ArchiveBorrowAnnotationKind.NOTE) {
                stats.noteCount += 1;
            }
            annotationStatsByRequest.set(annotation.requestId, stats);
        }

        const currentlyReading = requests
            .filter((req) => req.status === ArchiveBorrowStatus.ACTIVE)
            .map((req) => {
                const progress = latestProgressByRequest.get(req.id);
                if (!progress) return null;
                return {
                    requestId: req.id,
                    status: req.status,
                    approvedUntil: req.approvedUntil,
                    reason: req.reason,
                    fileId: progress.fileId,
                    fileName: fileNameById.get(progress.fileId) ?? progress.fileId,
                    page: progress.page,
                    updatedAt: progress.updatedAt,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item != null)
            .sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );

        const saved = requests
            .filter((req) => req.status === ArchiveBorrowStatus.ACTIVE)
            .map((req) => {
                const stats = annotationStatsByRequest.get(req.id);
                if (
                    !stats ||
                    stats.bookmarkCount + stats.noteCount === 0
                ) {
                    return null;
                }
                const progress = latestProgressByRequest.get(req.id);
                return {
                    requestId: req.id,
                    status: req.status,
                    approvedUntil: req.approvedUntil,
                    reason: req.reason,
                    bookmarkCount: stats.bookmarkCount,
                    noteCount: stats.noteCount,
                    lastFileId: progress?.fileId ?? null,
                    lastFileName: progress
                        ? fileNameById.get(progress.fileId) ?? progress.fileId
                        : null,
                    lastPage: progress?.page ?? null,
                    updatedAt: progress?.updatedAt ?? req.updatedAt,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item != null)
            .sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );

        return { currentlyReading, saved };
    },

    async expireDueRequests(): Promise<{ expiredCount: number }> {
        const now = new Date();
        const due = await db
            .update(archiveBorrowRequests)
            .set({
                status: ArchiveBorrowStatus.EXPIRED,
                expiredAt: now,
                updatedAt: now,
            })
            .where(
                and(
                    eq(archiveBorrowRequests.medium, ArchiveBorrowMedium.ELECTRONIC),
                    inArray(archiveBorrowRequests.status, [
                        ArchiveBorrowStatus.APPROVED,
                        ArchiveBorrowStatus.ACTIVE,
                    ]),
                    lte(archiveBorrowRequests.approvedUntil, now),
                ),
            )
            .returning({ id: archiveBorrowRequests.id });

        for (const row of due) {
            await revokeBorrowDipPackage(row.id);
            logWarehouseAudit({
                userId: null,
                module: "archive-borrow",
                eventType: "expire_borrow",
                summary: `Hết hạn phiếu mượn ${row.id}`,
                entityType: "archive_borrow_request",
                entityId: row.id,
            });
        }

        return { expiredCount: due.length };
    },
};
