import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS,
    ArchiveAclService,
} from "./archive-acl-service.ts";

const principalSchema = t.Object({
    kind: t.Union([t.Literal("user"), t.Literal("role")]),
    id: t.String({ minLength: 1 }),
});

const resourceKindSchema = t.Union([
    t.Literal("fond"),
    t.Literal("dossier_type"),
    t.Literal("document_type"),
]);

export function createArchiveAclAdminRouter(basePath: string = "/archive-acl") {
    const tags = ["Admin", "ArchiveAcl"];

    return new Elysia({ name: "archiveAclAdminRouter", prefix: basePath })
        .use(plugins.authProfile)
        .get("/matrix", async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAclService.getMatrix();
        }, {
            detail: {
                tags,
                summary: "ACL matrix theo phông / loại hồ sơ / loại tài liệu",
            },
        })
        .get("/catalog", async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAclService.listPrincipalCatalog();
        }, {
            detail: { tags, summary: "Danh sách user và role để gán ACL" },
        })
        .put("/principals", async ({ profile, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAclService.setPrincipals({
                resourceKind: body.resourceKind,
                resourceId: body.resourceId,
                permissionKey: body.permissionKey,
                principals: body.principals,
            });
        }, {
            body: t.Object({
                resourceKind: resourceKindSchema,
                resourceId: t.String({ minLength: 1 }),
                permissionKey: t.Union(
                    ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS.map((k) => t.Literal(k)),
                ),
                principals: t.Array(principalSchema),
            }),
            detail: {
                tags,
                summary: "Gán principals cho một quyền trên một resource",
            },
        })
        .post("/apply-all-permissions", async ({ profile, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAclService.applyAllPermissions({
                resourceKind: body.resourceKind,
                resourceId: body.resourceId,
                principals: body.principals,
            });
        }, {
            body: t.Object({
                resourceKind: resourceKindSchema,
                resourceId: t.String({ minLength: 1 }),
                principals: t.Array(principalSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Áp dụng tất cả quyền warehouse cho user/role trên một resource",
            },
        });
}
