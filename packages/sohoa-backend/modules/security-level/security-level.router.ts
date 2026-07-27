import { Elysia, t } from "elysia";
import { SecurityLevelService as service } from "./security-level-service.ts";
import { SecurityPermissionDefService as defService } from "./security-permission-def-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createPermissionDefSchema,
    createSecurityLevelSchema,
    patchSecurityLevelRulesSchema,
    updatePermissionDefSchema,
    updateSecurityLevelSchema,
    verifySecurityLevelAccessSchema,
} from "./types.ts";
import { verifyLevelPassword } from "./security-access-token.ts";

const idParamSchema = t.Object({
    id: t.String({ format: "uuid", description: "ID cấp độ bảo mật" }),
});

export function createSecurityLevelRouter(basePath: string = "/security-levels") {
    const meta = service.getMetadata?.();
    const tags = [["SecurityLevel", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "securityLevelRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

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

    app.post(
        "/verify-access",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_READ);
            return await verifyLevelPassword({
                userId: profile.id,
                securityLevelId: body.securityLevelId,
                password: body.password,
            });
        },
        {
            body: verifySecurityLevelAccessSchema,
            detail: {
                tags,
                summary: "Xác thực mật khẩu cấp độ bảo mật",
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

    app.get(
        "/:id/rules",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            return await service.getRules(params.id);
        },
        {
            params: idParamSchema,
            detail: {
                tags,
                summary: "Lấy cấu hình rule (effective + override) theo cấp",
            },
        },
    );

    app.patch(
        "/:id/rules",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            return await service.patchRules(params.id, body);
        },
        {
            params: idParamSchema,
            body: patchSecurityLevelRulesSchema,
            detail: {
                tags,
                summary: "Cập nhật rule / mật khẩu cấp (kế thừa & ghi đè)",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CREATE);
            const record = await service.create(body);
            set.status = 201;
            return { record };
        },
        {
            ...docs.create,
            body: createSecurityLevelSchema,
        },
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_UPDATE);
            const record = await service.update(params.id, body);
            return { record };
        },
        {
            ...docs.update,
            params: idParamSchema,
            body: updateSecurityLevelSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_DELETE);
            const record = await service.delete(params.id);
            return { record };
        },
        {
            ...docs.delete,
            params: idParamSchema,
        },
    );

    return app;
}

export function createSecurityPermissionDefRouter(basePath: string = "/security-permission-defs") {
    const tags = ["SecurityPermissionDef"];
    const docs = defService.getDocs({ tags });

    const app = new Elysia({
        name: "securityPermissionDefRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            return await defService.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/active",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_READ);
            return await defService.listActive();
        },
        {
            detail: { tags, summary: "Danh sách quyền bảo mật đang active" },
        },
    );

    app.post(
        "/",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            const record = await defService.create(body);
            set.status = 201;
            return { record };
        },
        {
            ...docs.create,
            body: createPermissionDefSchema,
        },
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            const record = await defService.update(params.id, body);
            return { record };
        },
        {
            ...docs.update,
            params: idParamSchema,
            body: updatePermissionDefSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CONFIG);
            const record = await defService.delete(params.id);
            return { record };
        },
        {
            ...docs.delete,
            params: idParamSchema,
        },
    );

    return app;
}
