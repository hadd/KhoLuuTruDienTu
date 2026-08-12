import { Elysia, t } from "elysia";
import { Buffer } from "node:buffer";
import { httpError } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { ArchiveBorrowStatus } from "../../db/schemas/archive-borrow-constants.ts";
import {
    hasArchiveBorrowRequestPermission,
    hasArchiveBorrowReviewPermission,
} from "./archive-borrow-permissions.ts";
import { ArchiveBorrowService } from "./archive-borrow-service.ts";

const tags = ["Archive Borrow"];

function requireProfile(profile: UserWithRoles | null | undefined): UserWithRoles {
    if (!profile) {
        throw httpError.unauthorized("Authentication required");
    }
    return profile;
}

function parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw httpError.badRequest(`${field} is invalid`);
    }
    return date;
}

export function createArchiveBorrowRouter(prefix = "/archive-borrow-requests") {
    return new Elysia({ prefix })
        .use(plugins.authProfile)
        .post(
            "/",
            async ({ body, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowRequestPermission(user)) {
                    throw httpError.forbidden("library.borrow.request required");
                }
                return await ArchiveBorrowService.createElectronicRequest(user, {
                    reason: body.reason,
                    requestedFrom: parseDate(body.requestedFrom, "requestedFrom"),
                    requestedUntil: parseDate(body.requestedUntil, "requestedUntil"),
                    items: body.items.map((item) =>
                        item.itemKind === "FILE"
                            ? {
                                itemKind: "FILE" as const,
                                dossierId: item.dossierId,
                                fileId: item.fileId!,
                            }
                            : {
                                itemKind: "DOSSIER" as const,
                                dossierId: item.dossierId,
                            }
                    ),
                });
            },
            {
                body: t.Object({
                    reason: t.String({ minLength: 1 }),
                    requestedFrom: t.String({ format: "date-time" }),
                    requestedUntil: t.String({ format: "date-time" }),
                    items: t.Array(
                        t.Object({
                            itemKind: t.Union([t.Literal("FILE"), t.Literal("DOSSIER")]),
                            dossierId: t.String({ format: "uuid" }),
                            fileId: t.Optional(t.String({ format: "uuid" })),
                        }),
                        { minItems: 1 },
                    ),
                }),
                detail: {
                    tags,
                    summary: "Create electronic borrow request",
                },
            },
        )
        .get(
            "/mine",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.listMine(user, {
                    page: query.page,
                    limit: query.limit,
                    search: query.search,
                });
            },
            {
                query: t.Object({
                    page: t.Optional(t.Numeric()),
                    limit: t.Optional(t.Numeric()),
                    search: t.Optional(t.String()),
                }),
                detail: {
                    tags,
                    summary: "List my electronic borrow requests",
                },
            },
        )
        .get(
            "/mine/reading-summary",
            async ({ profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.getReadingSummary(user);
            },
            {
                detail: {
                    tags,
                    summary:
                        "Reading summary for my borrows (currently reading + saved annotations)",
                },
            },
        )
        .get(
            "/pending",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowReviewPermission(user)) {
                    throw httpError.forbidden("library.borrow.review required");
                }
                return await ArchiveBorrowService.listPending(user, {
                    limit: query.limit,
                    offset: query.offset,
                });
            },
            {
                query: t.Object({
                    limit: t.Optional(t.Numeric()),
                    offset: t.Optional(t.Numeric()),
                }),
                detail: {
                    tags,
                    summary: "List pending electronic borrow requests",
                },
            },
        )
        .get(
            "/review",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowReviewPermission(user)) {
                    throw httpError.forbidden("library.borrow.review required");
                }
                return await ArchiveBorrowService.listForReview(user, {
                    page: query.page,
                    limit: query.limit,
                    search: query.search,
                    status: query.status,
                });
            },
            {
                query: t.Object({
                    page: t.Optional(t.Numeric()),
                    limit: t.Optional(t.Numeric()),
                    search: t.Optional(t.String()),
                    status: t.Optional(t.Enum(ArchiveBorrowStatus)),
                }),
                detail: {
                    tags,
                    summary:
                        "List all electronic borrow requests in reviewer scope (pending and processed)",
                },
            },
        )
        .get(
            "/search-dossiers",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowRequestPermission(user)) {
                    throw httpError.forbidden("library.borrow.request required");
                }
                return await ArchiveBorrowService.searchEligibleDossiers(user, {
                    q: query.q,
                    limit: query.limit,
                });
            },
            {
                query: t.Object({
                    q: t.String({ minLength: 2 }),
                    limit: t.Optional(t.Numeric()),
                }),
                detail: {
                    tags,
                    summary:
                        "Search ARCHIVED dossier metadata eligible for share (security level), for borrow registration",
                },
            },
        )
        .get(
            "/:id",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.getById(user, params.id);
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Get borrow request detail",
                },
            },
        )
        .post(
            "/:id/approve",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.approve(user, params.id, {
                    approvedFrom: parseDate(body.approvedFrom, "approvedFrom"),
                    approvedUntil: parseDate(body.approvedUntil, "approvedUntil"),
                    reviewNotes: body.reviewNotes,
                    placementId: body.placementId,
                });
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                body: t.Object({
                    approvedFrom: t.String({ format: "date-time" }),
                    approvedUntil: t.String({ format: "date-time" }),
                    reviewNotes: t.Optional(t.String()),
                    placementId: t.Optional(t.String({ format: "uuid" })),
                }),
                detail: {
                    tags,
                    summary: "Approve electronic borrow request and generate DIP",
                },
            },
        )
        .post(
            "/:id/reject",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.reject(user, params.id, {
                    reviewNotes: body.reviewNotes,
                });
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                body: t.Object({
                    reviewNotes: t.String({ minLength: 1 }),
                }),
                detail: {
                    tags,
                    summary: "Reject electronic borrow request",
                },
            },
        )
        .post(
            "/:id/regenerate-dip",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.regenerateDip(user, params.id, {
                    placementId: body?.placementId,
                });
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                body: t.Optional(
                    t.Object({
                        placementId: t.Optional(t.String({ format: "uuid" })),
                    }),
                ),
                detail: {
                    tags,
                    summary: "Regenerate failed DIP package for an approved borrow",
                },
            },
        )
        .post(
            "/:id/activate",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.activate(user, params.id);
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Activate online view link for approved borrow",
                },
            },
        )
        .get(
            "/:id/view-model",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.getViewModel(user, params.id);
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Borrow viewer model (dossiers + DIP files, ACTIVE only)",
                },
            },
        )
        .get(
            "/:id/dossiers/:dossierId/metadata",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.getDossierMetadata(
                    user,
                    params.id,
                    params.dossierId,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                    dossierId: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Proxy dossier metadata JSON for ACTIVE borrow viewer",
                },
            },
        )
        .get(
            "/:id/dip/files/:fileId/content",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                const result = await ArchiveBorrowService.getDipFileContent(
                    user,
                    params.id,
                    params.fileId,
                );
                const safeName = result.fileName
                    .replace(/[\r\n"]+/g, "_")
                    .trim() || `${result.fileId}.pdf`;
                return new Response(Buffer.from(result.bytes), {
                    headers: {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": `inline; filename="${safeName}"`,
                        "Cache-Control": "private, no-store",
                        "X-Content-Type-Options": "nosniff",
                    },
                });
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                    fileId: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Stream DIP PDF for online view (authenticated proxy)",
                },
            },
        )
        .get(
            "/:id/reading-progress",
            async ({ params, query, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.getReadingProgress(
                    user,
                    params.id,
                    query.fileId,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                query: t.Object({
                    fileId: t.Optional(t.String({ format: "uuid" })),
                }),
                detail: {
                    tags,
                    summary: "Get personal reading progress for a borrow",
                },
            },
        )
        .put(
            "/:id/reading-progress",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.upsertReadingProgress(
                    user,
                    params.id,
                    body,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                body: t.Object({
                    fileId: t.String({ format: "uuid" }),
                    page: t.Integer({ minimum: 1 }),
                }),
                detail: {
                    tags,
                    summary: "Upsert personal reading progress (ACTIVE only)",
                },
            },
        )
        .get(
            "/:id/annotations",
            async ({ params, query, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.listAnnotations(user, params.id, {
                    fileId: query.fileId,
                    kind: query.kind as "BOOKMARK" | "NOTE" | undefined,
                });
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                query: t.Object({
                    fileId: t.Optional(t.String({ format: "uuid" })),
                    kind: t.Optional(
                        t.Union([
                            t.Literal("BOOKMARK"),
                            t.Literal("NOTE"),
                        ]),
                    ),
                }),
                detail: {
                    tags,
                    summary: "List personal annotations for a borrow",
                },
            },
        )
        .post(
            "/:id/annotations",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.createAnnotation(
                    user,
                    params.id,
                    body,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                }),
                body: t.Object({
                    kind: t.Union([
                        t.Literal("BOOKMARK"),
                        t.Literal("NOTE"),
                    ]),
                    fileId: t.String({ format: "uuid" }),
                    page: t.Integer({ minimum: 1 }),
                    bbox: t.Optional(
                        t.Union([
                            t.Null(),
                            t.Array(t.Number(), { minItems: 4, maxItems: 4 }),
                        ]),
                    ),
                    selectedText: t.Optional(t.Union([t.String(), t.Null()])),
                    body: t.Optional(t.Union([t.String(), t.Null()])),
                    color: t.Optional(t.Union([t.String(), t.Null()])),
                }),
                detail: {
                    tags,
                    summary: "Create personal annotation (ACTIVE only)",
                },
            },
        )
        .patch(
            "/:id/annotations/:annotationId",
            async ({ params, body, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.updateAnnotation(
                    user,
                    params.id,
                    params.annotationId,
                    body,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                    annotationId: t.String({ format: "uuid" }),
                }),
                body: t.Object({
                    page: t.Optional(t.Integer({ minimum: 1 })),
                    bbox: t.Optional(
                        t.Union([
                            t.Null(),
                            t.Array(t.Number(), { minItems: 4, maxItems: 4 }),
                        ]),
                    ),
                    selectedText: t.Optional(t.Union([t.String(), t.Null()])),
                    body: t.Optional(t.Union([t.String(), t.Null()])),
                    color: t.Optional(t.Union([t.String(), t.Null()])),
                }),
                detail: {
                    tags,
                    summary: "Update personal annotation (ACTIVE only)",
                },
            },
        )
        .delete(
            "/:id/annotations/:annotationId",
            async ({ params, profile }) => {
                const user = requireProfile(profile);
                return await ArchiveBorrowService.deleteAnnotation(
                    user,
                    params.id,
                    params.annotationId,
                );
            },
            {
                params: t.Object({
                    id: t.String({ format: "uuid" }),
                    annotationId: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Delete personal annotation (ACTIVE only)",
                },
            },
        );
}
