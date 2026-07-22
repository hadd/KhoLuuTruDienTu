import { Elysia, t } from "elysia";
import { SecurityLevelService as service } from "./security-level-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    scheduleSecurityLevelChangedNotification,
} from "../notification/notification-delivery-service.ts";
import type { SecurityLevelChangeAction } from "../notification/types.ts";

const idParamSchema = t.Object({
    id: t.String({ format: "uuid", description: "ID cấp độ bảo mật" }),
});

type RequestWithAuditMeta = Request & {
    __body?: unknown;
    __auditAction?: string;
};

function buildAuditPayload<T>(before: T | null, after: T | null) {
    return { before, after };
}

function scheduleSecurityLevelNotification(input: {
    securityLevelId: string;
    securityLevelName: string;
    actorId: string;
    action: SecurityLevelChangeAction;
    isActive?: boolean;
}) {
    scheduleSecurityLevelChangedNotification({
        securityLevelId: input.securityLevelId,
        securityLevelName: input.securityLevelName,
        actorId: input.actorId,
        action: input.action,
        isActive: input.isActive,
    });
}

export function createSecurityLevelRouter(basePath: string = "/security-levels") {
    const meta = service.getMetadata?.();
    const tags = [["SecurityLevel", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "securityLevelRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile)
        .use(plugins.createAuditLogPlugin({ logResponseBody: true, maxResponseBodySize: 4000 }));

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/active",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_READ);
            return await service.listActive();
        },
        {
            detail: {
                tags,
                summary: "Lấy danh sách cấp độ bảo mật đang hoạt động",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_READ);
            const record = await service.get(params.id);
            return { record };
        },
        {
            ...docs.get,
            params: idParamSchema,
        },
    );

    app.post(
        "/",
        async ({ body, profile, request, set }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CREATE);
            const reqWithMeta = request as RequestWithAuditMeta;
            reqWithMeta.__auditAction = "security-level-create";
            reqWithMeta.__body = {
                ...body,
                audit: buildAuditPayload(null, null),
            };

            const record = await service.create(body);
            set.status = 201;

            scheduleSecurityLevelNotification({
                securityLevelId: record.id,
                securityLevelName: record.name,
                actorId: profile.id,
                action: "created",
                isActive: record.isActive,
            });

            return {
                record,
                status: "created",
                audit: buildAuditPayload(null, record),
            };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile, request }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_UPDATE);
            const before = await service.get(params.id);
            const reqWithMeta = request as RequestWithAuditMeta;
            const isStatusChange = body.isActive !== undefined && body.isActive !== before.isActive;

            reqWithMeta.__auditAction = isStatusChange
                ? "security-level-status-change"
                : "security-level-update";
            reqWithMeta.__body = {
                ...body,
                audit: buildAuditPayload(before, null),
            };

            const record = await service.update(params.id, body);
            const audit = buildAuditPayload(before, record);

            scheduleSecurityLevelNotification({
                securityLevelId: record.id,
                securityLevelName: record.name,
                actorId: profile.id,
                action: isStatusChange ? "status_changed" : "updated",
                isActive: record.isActive,
            });

            return {
                record,
                status: "updated",
                audit,
            };
        },
        {
            ...docs.update,
            params: idParamSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile, request }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_DELETE);
            const before = await service.get(params.id);
            const reqWithMeta = request as RequestWithAuditMeta;
            reqWithMeta.__auditAction = "security-level-delete";
            reqWithMeta.__body = { audit: buildAuditPayload(before, null) };

            const record = await service.delete(params.id);

            scheduleSecurityLevelNotification({
                securityLevelId: before.id,
                securityLevelName: before.name,
                actorId: profile.id,
                action: "deleted",
                isActive: before.isActive,
            });

            return {
                record,
                status: "deleted",
                audit: buildAuditPayload(before, record),
            };
        },
        {
            ...docs.delete,
            params: idParamSchema,
        },
    );

    return app;
}
