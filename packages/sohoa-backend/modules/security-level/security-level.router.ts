import { Elysia, t } from "elysia";
import { SecurityLevelService as service } from "./security-level-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

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
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.SECURITY_LEVELS_CREATE);
            const record = await service.create(body);
            set.status = 201;
            return { record };
        },
        docs.create,
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
