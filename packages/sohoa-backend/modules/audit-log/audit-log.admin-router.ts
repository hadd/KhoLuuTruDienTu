import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { AuditLogService as service } from "./audit-log-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

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
                summary: "Export audit logs (live + archived)",
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
