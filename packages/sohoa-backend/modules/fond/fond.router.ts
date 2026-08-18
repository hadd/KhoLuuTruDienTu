// @/features/archive-fond/fond-router.ts

import { Elysia, t } from "elysia";
import { FondService as service } from "./fond-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { indexFondById } from "../search/adapters/fond.adapter.ts";
import { fondEntitySchema } from "./types.ts"; // 1. Bổ sung import Schema từ types

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
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.FONDS_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/active",
        async ({ profile }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.FONDS_READ,
                Permission.DATA_ENTRY_MAKER,
                Permission.DATA_ENTRY_CHECKER,
            ]);
            return await service.listActive();
        },
        {
            detail: {
                tags,
                summary: "Lấy danh sách phông đang hoạt động",
                description: "Lấy tất cả các phông có trạng thái isActive = true và chưa bị xóa.",
            }
        }
    );

    // 2. Chuyển endpoint tĩnh này lên trước '/:id' để tránh lỗi xung đột tham số định tuyến
    app.get(
        "/active-with-count",
        async ({ profile }) => {
            // 3. Bổ sung kiểm tra quyền bảo mật tương tự như API '/active'
            authHelper.checkPermissionAny(profile, [
                Permission.FONDS_READ,
                Permission.DATA_ENTRY_MAKER,
                Permission.DATA_ENTRY_CHECKER,
            ]);
            // 4. Sửa FondService thành service cho khớp với tên import
            return await service.listActiveWithDossierCount();
        },
        {
            response: t.Object({
                items: t.Array(fondEntitySchema)
            }),
            detail: {
                summary: "Lấy danh sách phông hoạt động đi kèm số lượng hồ sơ",
                tags,
            }
        }
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.FONDS_READ);
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
            authHelper.checkPermission(profile, Permission.FONDS_CREATE);
            const record = await service.create(body);
            indexFondById(record.id).catch(() => undefined);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.FONDS_UPDATE);
            const record = await service.update(params.id, body);
            indexFondById(params.id).catch(() => undefined);
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
            authHelper.checkPermission(profile, Permission.FONDS_DELETE);
            const record = await service.delete(params.id);
            indexFondById(params.id).catch(() => undefined);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            params: fondIdParamSchema,
        }
    );

    return app;
}