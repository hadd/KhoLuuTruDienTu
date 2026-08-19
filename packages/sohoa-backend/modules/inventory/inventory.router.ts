import { Elysia, t } from "elysia";
import { InventoryService as service } from "./inventory-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission, INVENTORY_ACTIVE_READ_PERMISSIONS } from "../auth/permission-catalog.ts";

const idParamSchema = t.Object({
    id: t.String({ description: "Mã mục lục" }),
});

export function createInventoryRouter(basePath: string = "/inventories") {
    const meta = service.getMetadata?.();
    const tags = [["Inventory", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "inventoryRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.INVENTORIES_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/active",
        async ({ profile }) => {
            authHelper.checkPermissionAny(profile, INVENTORY_ACTIVE_READ_PERMISSIONS);
            return await service.listActive();
        },
        {
            detail: {
                tags,
                summary: "Lấy danh sách mục lục đang hoạt động",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.INVENTORIES_READ);
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
            authHelper.checkPermission(profile, Permission.INVENTORIES_CREATE);
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.INVENTORIES_UPDATE);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        {
            ...docs.update,
            params: idParamSchema,
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.INVENTORIES_DELETE);
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            params: idParamSchema,
        },
    );

    return app;
}
