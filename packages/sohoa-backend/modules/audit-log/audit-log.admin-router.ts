import { Elysia, t } from "elysia";
import { IdParam, httpError } from "@shared/common-lib";
import { AuditLogService as service } from "./audit-log-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { getS3Client } from "../../libs/s3.ts";
import { env } from "../../env.ts";

const listQuerySchema = t.Object({
    page: t.Optional(t.Numeric({ minimum: 1 })),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
    search: t.Optional(t.String()),
    userId: t.Optional(t.String()),
    dateFrom: t.Optional(t.String()),
    dateTo: t.Optional(t.String()),
    module: t.Optional(t.String()),
    eventType: t.Optional(t.String()),
});

function toListQuery(query: Record<string, unknown>) {
    return {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: typeof query.search === "string" ? query.search : undefined,
        userId: typeof query.userId === "string" ? query.userId : undefined,
        dateFrom: typeof query.dateFrom === "string" ? query.dateFrom : undefined,
        dateTo: typeof query.dateTo === "string" ? query.dateTo : undefined,
        module: typeof query.module === "string" ? query.module : undefined,
        eventType: typeof query.eventType === "string" ? query.eventType : undefined,
    };
}

export function createAuditLogAdminRouter(basePath: string = "/audit-logs") {
    const meta = service.getMetadata?.();
    const tags = [["Admin", "Audit Log", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "auditLogAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.urlQuery)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_READ);
            return await service.listFiltered(toListQuery(urlQuery as Record<string, unknown>));
        },
        {
            ...docs.list,
            query: listQuerySchema,
        },
    );

    app.get(
        "/filter-options",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_READ);
            return service.getFilterOptions();
        },
        {
            detail: {
                tags,
                summary: "Get audit log filter options (basic actions and per-module actions)",
            },
        },
    );

    app.get(
        "/export",
        async ({ query, profile, set }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_EXPORT);
            const format = query.format === "xlsx" ? "xlsx" : "json";
            const exported = await service.exportRecords(
                toListQuery(query as Record<string, unknown>),
                format,
            );
            set.headers["content-type"] = exported.contentType;
            set.headers["content-disposition"] = `attachment; filename="${exported.filename}"`;
            return exported.data;
        },
        {
            query: t.Composite([
                listQuerySchema,
                t.Object({
                    format: t.Optional(t.Union([t.Literal("json"), t.Literal("xlsx")])),
                }),
            ]),
            detail: {
                tags,
                summary: "Export audit logs",
            },
        },
    );

    app.get(
        "/archives",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_EXPORT);
            const filterBy = urlQuery.filterBy === "exportedAt" ? "exportedAt" as const : undefined;
            return await service.listArchives({
                page: urlQuery.page ? Number(urlQuery.page) : undefined,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                dateFrom: typeof urlQuery.dateFrom === "string" ? urlQuery.dateFrom : undefined,
                dateTo: typeof urlQuery.dateTo === "string" ? urlQuery.dateTo : undefined,
                filterBy,
            });
        },
        {
            query: t.Object({
                page: t.Optional(t.Numeric({ minimum: 1 })),
                limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
                dateFrom: t.Optional(t.String()),
                dateTo: t.Optional(t.String()),
                filterBy: t.Optional(t.Union([t.Literal("logRange"), t.Literal("exportedAt")])),
            }),
            detail: {
                tags,
                summary: "List archived audit log exports",
            },
        },
    );

    app.get(
        "/archives/:id/records",
        async ({ params, urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_EXPORT);
            return await service.listArchiveRecordsById(params.id, {
                page: urlQuery.page ? Number(urlQuery.page) : undefined,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                search: typeof urlQuery.search === "string" ? urlQuery.search : undefined,
                module: typeof urlQuery.module === "string" ? urlQuery.module : undefined,
                eventType: typeof urlQuery.eventType === "string" ? urlQuery.eventType : undefined,
            });
        },
        {
            params: t.Object({ id: IdParam("Archive ID") }),
            query: t.Object({
                page: t.Optional(t.Numeric({ minimum: 1 })),
                limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
                search: t.Optional(t.String()),
                module: t.Optional(t.String()),
                eventType: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "List records from a specific archived audit log export",
            },
        },
    );

    app.get(
        "/archives/:id/download",
        async ({ params, query, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_EXPORT);
            const archive = await service.getArchive(params.id);
            const format = query.format === "xlsx" ? "xlsx" : "json";
            const objectKey = format === "xlsx" ? archive.excelObjectKey : archive.jsonObjectKey;
            if (!objectKey) {
                throw httpError.notFound("Archive file not found");
            }
            const s3 = await getS3Client();
            if (!s3 || !env.S3?.bucket) {
                throw httpError.serviceUnavailable("S3 is not configured");
            }
            const url = await s3.getMinIOClient().presignedGetObject(
                env.S3.bucket,
                objectKey,
                60 * 60,
            );
            return { url, objectKey, format };
        },
        {
            params: t.Object({ id: IdParam("Archive ID") }),
            query: t.Object({
                format: t.Optional(t.Union([t.Literal("json"), t.Literal("xlsx")])),
            }),
            detail: {
                tags,
                summary: "Get presigned download URL for archived audit logs",
            },
        },
    );

    app.post(
        "/purge",
        async ({ profile, body }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_DELETE);
            return await service.purgeExpired({ dryRun: body?.dryRun ?? false });
        },
        {
            body: t.Optional(t.Object({
                dryRun: t.Optional(t.Boolean()),
            })),
            detail: {
                tags,
                summary: "Manually purge expired audit logs (export to MinIO first)",
            },
        },
    );

    app.delete(
        "/bulk",
        async ({ profile, body }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_DELETE);
            return await service.deleteBulk({
                ids: body.ids,
                query: body.query ? toListQuery(body.query as Record<string, unknown>) : undefined,
            });
        },
        {
            body: t.Object({
                ids: t.Optional(t.Array(t.String())),
                query: t.Optional(t.Record(t.String(), t.Any())),
            }),
            detail: {
                tags,
                summary: "Bulk delete audit logs",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_READ);
            const record = await service.get(params.id);
            return { record };
        },
        {
            ...docs.get,
            params: t.Object({ id: IdParam("Audit Log ID") }),
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.AUDIT_LOGS_DELETE);
            const record = await service.deleteById(params.id);
            return { record };
        },
        {
            params: t.Object({ id: IdParam("Audit Log ID") }),
            detail: {
                tags,
                summary: "Delete audit log by ID",
            },
        },
    );

    return app;
}
