import { Elysia } from "elysia";
import { createProfileAdminRouter } from "../modules/profile/profile.admin-router.ts";
import { createAuditLogAdminRouter } from "../modules/audit-log/audit-log.admin-router.ts";
import { createFolderAdminRouter } from "../modules/folder/folder.admin-router.ts";
import { createGroupAdminRouter } from "../modules/group/group.admin-router.ts";
import { createRoleAdminRouter } from "../modules/role/role.admin-router.ts";
import { createPermissionAdminRouter } from "../modules/role/permission.admin-router.ts";
import { createMetadataTemplateAdminRouter } from "../modules/metadata-template/metadata-template.admin-router.ts";
import { createMetadataPermissionAdminRouter } from "../modules/metadata-permission/metadata-permission.admin-router.ts";
import { createDashboardAdminRouter } from "../modules/dashboard/index.ts";
import { createProjectAdminRouter } from "../modules/project/index.ts";

export const adminRouter = new Elysia({
    prefix: "/api/v1/admin",
})
    .use(createProfileAdminRouter())
    .use(createPermissionAdminRouter())
    .use(createRoleAdminRouter())
    .use(createAuditLogAdminRouter())
    .use(createFolderAdminRouter())
    .use(createMetadataTemplateAdminRouter())
    .use(createMetadataPermissionAdminRouter())
    .use(createGroupAdminRouter())
    .use(createProjectAdminRouter())
    .use(createDashboardAdminRouter());
