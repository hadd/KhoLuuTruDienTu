import { Elysia, t } from "elysia";
import { httpError } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { AuthRole, authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import {
    ARCHIVE_WAREHOUSE_ACL_PERMISSION_KEYS,
    ArchiveAclService,
} from "./archive-acl-service.ts";
import { ArchiveMetadataAclService } from "./archive-metadata-acl-service.ts";

const principalSchema = t.Object({
    kind: t.Union([t.Literal("user"), t.Literal("role")]),
    id: t.String({ minLength: 1 }),
});

const resourceKindSchema = t.Union([
    t.Literal("fond"),
    t.Literal("fond_type"),
    t.Literal("dossier_type"),
    t.Literal("document_type"),
]);

/**
 * Quyền cấu hình ACL kho: `archive.permissions.manage`
 * (khác với quyền vận hành kho edit/delete/reupload — đã bỏ warehouse.manage).
 * Admin / project_manager vẫn được vào.
 */
function checkArchivePermissionsManage(profile: UserWithRoles) {
    if (
        userRolesHavePermission(
            profile.userRoles,
            Permission.ARCHIVE_PERMISSIONS_MANAGE,
        )
    ) {
        return;
    }
    if (authHelper.hasRoleAny(profile, [AuthRole.ADMIN, AuthRole.PROJECT_MANAGER])) {
        return;
    }
    throw httpError.forbidden(
        `Permission required: ${Permission.ARCHIVE_PERMISSIONS_MANAGE}`,
    );
}

export function createArchiveAclAdminRouter(basePath: string = "/archive-acl") {
    const tags = ["Admin", "ArchiveAcl"];

    return new Elysia({ name: "archiveAclAdminRouter", prefix: basePath })
        .use(plugins.authProfile)
        .get("/matrix", async ({ profile }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveAclService.getMatrix();
        }, {
            detail: {
                tags,
                summary: "ACL matrix theo loại phông / phông / loại hồ sơ / loại tài liệu",
            },
        })
        .get("/catalog", async ({ profile }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveAclService.listPrincipalCatalog();
        }, {
            detail: { tags, summary: "Danh sách user và role để gán ACL" },
        })
        .put("/principals", async ({ profile, body }) => {
            checkArchivePermissionsManage(profile);
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
            checkArchivePermissionsManage(profile);
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
        })
        .get("/metadata-view", async ({ profile }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveMetadataAclService.listDocumentTypes();
        }, {
            detail: {
                tags,
                summary: "Danh sách loại tài liệu cho tab Metadata (cờ đã cấu hình)",
            },
        })
        .get("/metadata-view/:documentTypeId", async ({ profile, params }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveMetadataAclService.getDocumentTypeMatrix(params.documentTypeId);
        }, {
            params: t.Object({
                documentTypeId: t.String({ minLength: 1 }),
            }),
            detail: {
                tags,
                summary: "Ma trận phân quyền trường metadata theo loại tài liệu",
            },
        })
        .put("/metadata-view/:documentTypeId", async ({ profile, params, body }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveMetadataAclService.saveDocumentTypeMatrix(
                params.documentTypeId,
                body.slots,
            );
        }, {
            params: t.Object({
                documentTypeId: t.String({ minLength: 1 }),
            }),
            body: t.Object({
                slots: t.Array(t.Object({
                    slotCode: t.String({ minLength: 1 }),
                    sortOrder: t.Number(),
                    principals: t.Array(principalSchema),
                    fieldKeys: t.Array(t.String()),
                })),
            }),
            detail: {
                tags,
                summary: "Lưu ma trận phân quyền trường metadata",
            },
        })
        .post("/metadata-view/:documentTypeId/assign-all", async ({ profile, params, body }) => {
            checkArchivePermissionsManage(profile);
            return ArchiveMetadataAclService.assignAllToSlot(
                params.documentTypeId,
                body.slotCode,
                body.principals,
            );
        }, {
            params: t.Object({
                documentTypeId: t.String({ minLength: 1 }),
            }),
            body: t.Object({
                slotCode: t.String({ minLength: 1 }),
                principals: t.Array(principalSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Gán tất cả trường vào một cột phân quyền metadata",
            },
        });
}
