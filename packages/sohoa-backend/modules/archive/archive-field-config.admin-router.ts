import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    ARCHIVE_FIELD_TYPE_VALUES,
    ARCHIVE_REFERENCE_SOURCE_VALUES,
} from "../../db/schemas/archive-constants.ts";
import { ArchiveFieldConfigService } from "./archive-field-config-service.ts";

const tags = ["Admin", "Archive Field Config"];

const selectOptionSchema = t.Object({
    value: t.String({ minLength: 1, maxLength: 255 }),
    label: t.String({ minLength: 1, maxLength: 255 }),
});

const fieldConfigBodySchema = t.Object({
    fieldKey: t.String({ minLength: 1, maxLength: 100 }),
    label: t.String({ minLength: 1, maxLength: 255 }),
    fieldType: t.Union(ARCHIVE_FIELD_TYPE_VALUES.map((value) => t.Literal(value))),
    referenceSource: t.Optional(t.Nullable(
        t.Union(ARCHIVE_REFERENCE_SOURCE_VALUES.map((value) => t.Literal(value))),
    )),
    dependsOnFieldKey: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    isRequired: t.Optional(t.Boolean()),
    options: t.Optional(t.Array(selectOptionSchema)),
    displayOrder: t.Optional(t.Integer({ minimum: 0 })),
    isActive: t.Optional(t.Boolean()),
});

const updateFieldConfigBodySchema = t.Object({
    fieldKey: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    label: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    fieldType: t.Optional(
        t.Union(ARCHIVE_FIELD_TYPE_VALUES.map((value) => t.Literal(value))),
    ),
    referenceSource: t.Optional(t.Nullable(
        t.Union(ARCHIVE_REFERENCE_SOURCE_VALUES.map((value) => t.Literal(value))),
    )),
    dependsOnFieldKey: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    isRequired: t.Optional(t.Boolean()),
    options: t.Optional(t.Array(selectOptionSchema)),
    displayOrder: t.Optional(t.Integer({ minimum: 0 })),
    isActive: t.Optional(t.Boolean()),
});

export function createArchiveFieldConfigAdminRouter(
    basePath: string = "/archive-field-configs",
) {
    const app = new Elysia({
        name: "archiveFieldConfigAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_CONFIG_MANAGE);
            const items = await ArchiveFieldConfigService.listFieldConfigs(true);
            return { items };
        },
        {
            detail: {
                tags,
                summary: "Danh sách cấu hình trường lưu kho",
            },
        },
    );

    app.post(
        "/",
        async ({ profile, body, set }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_CONFIG_MANAGE);
            const record = await ArchiveFieldConfigService.createFieldConfig(body);
            set.status = 201;
            return { record, status: "created" };
        },
        {
            body: fieldConfigBodySchema,
            detail: {
                tags,
                summary: "Tạo cấu hình trường lưu kho",
            },
        },
    );

    app.put(
        "/reorder",
        async ({ profile, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_CONFIG_MANAGE);
            const items = await ArchiveFieldConfigService.reorderFields(body.ids);
            return { items, status: "updated" };
        },
        {
            body: t.Object({
                ids: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Sắp xếp lại thứ tự trường lưu kho",
            },
        },
    );

    app.put(
        "/:id",
        async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_CONFIG_MANAGE);
            const record = await ArchiveFieldConfigService.updateFieldConfig(params.id, body);
            return { record, status: "updated" };
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: updateFieldConfigBodySchema,
            detail: {
                tags,
                summary: "Cập nhật cấu hình trường lưu kho",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_CONFIG_MANAGE);
            const record = await ArchiveFieldConfigService.deleteFieldConfig(params.id);
            return { record, status: "deleted" };
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Vô hiệu hóa cấu hình trường lưu kho",
            },
        },
    );

    return app;
}
