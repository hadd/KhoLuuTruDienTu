import { Elysia, t } from "elysia";
import { FondService as service } from "./fond-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";



const fondIdParamSchema = t.Object({
    id: t.String({ description: "Mã phông (Fond ID)" }),
});

export function createFondRouter(basePath: string = "/fonds") {
    const meta = service.getMetadata?.();
    const tags = [["Fond", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "fondRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            // Require a proper permission, reusing FOLDERS_READ or similar, or create FONDS_READ
            authHelper.checkPermission(profile, Permission.FOLDERS_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.FOLDERS_READ);
            const record = await service.get(params.id);
            return { record };
        },
        {
            ...docs.get,
            params: fondIdParamSchema,
        },
    );

    app.post(
        "/",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.FOLDERS_WRITE);
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.FOLDERS_WRITE);
            // Notice: params.id is the original ID, body does not contain id per updateFondSchema
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        {
            ...docs.update,
            params: fondIdParamSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.FOLDERS_WRITE);
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            params: fondIdParamSchema,
        }
    );

    return app;
}
