import { Elysia, t } from "elysia";
import { Buffer } from "node:buffer";
import { httpError } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
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
                    throw httpError.forbidden("archive.borrow.request required");
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
                    summary: "List my electronic borrow requests",
                },
            },
        )
        .get(
            "/pending",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowReviewPermission(user)) {
                    throw httpError.forbidden("archive.borrow.review required");
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
            "/search-dossiers",
            async ({ query, profile }) => {
                const user = requireProfile(profile);
                if (!hasArchiveBorrowRequestPermission(user)) {
                    throw httpError.forbidden("archive.borrow.request required");
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
                        "Search ARCHIVED dossier metadata for borrow registration (no warehouse ACL)",
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
        );
}
