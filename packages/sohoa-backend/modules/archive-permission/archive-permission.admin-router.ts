import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ArchivePermissionService } from "./archive-permission-service.ts";

const slotSchema = t.Object({
    slotCode: t.String({ minLength: 1 }),
    slotName: t.String({ minLength: 1 }),
    sortOrder: t.Optional(t.Number()),
    permissionKeys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
    fondIds: t.Optional(t.Array(t.String())),
});

export function createArchivePermissionAdminRouter(
    basePath: string = "/archive-permission-configs",
) {
    const tags = ["Admin", "ArchivePermission"];

    return new Elysia({ name: "archivePermissionAdminRouter", prefix: basePath })
        .use(plugins.authProfile)
        .get("/options", ({ profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return ArchivePermissionService.listReadyOptions();
        }, { detail: { tags, summary: "List ready archive permission configs" } })
        .get("/", async ({ profile, query }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchivePermissionService.list(query.status);
        }, {
            query: t.Object({
                status: t.Optional(t.Union([
                    t.Literal("draft"),
                    t.Literal("ready"),
                    t.Literal("close"),
                ])),
            }),
            detail: { tags, summary: "List archive permission configs" },
        })
        .get("/:id", async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchivePermissionService.get(params.id);
        }, {
            params: t.Object({ id: IdParam("Config ID") }),
            detail: { tags, summary: "Get archive permission config" },
        })
        .post("/", async ({ profile, body, set }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            const result = await ArchivePermissionService.create(body);
            set.status = 201;
            return result;
        }, {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 255 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
            }),
            detail: { tags, summary: "Create archive permission config" },
        })
        .put("/:id", async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchivePermissionService.update(params.id, body);
        }, {
            params: t.Object({ id: IdParam("Config ID") }),
            body: t.Object({
                name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
                status: t.Optional(t.Union([
                    t.Literal("draft"),
                    t.Literal("ready"),
                    t.Literal("close"),
                ])),
                slots: t.Optional(t.Array(slotSchema)),
            }),
            detail: { tags, summary: "Update archive permission config" },
        })
        .delete("/:id", async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchivePermissionService.delete(params.id);
        }, {
            params: t.Object({ id: IdParam("Config ID") }),
            detail: { tags, summary: "Delete archive permission config" },
        });
}
