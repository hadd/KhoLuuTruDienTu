import { Elysia } from "elysia";
import { createProfileAdminRouter } from "../modules/profile/profile.admin-router.ts";
import { createAuditLogAdminRouter } from "../modules/audit-log/audit-log.admin-router.ts";
import { createFolderAdminRouter } from "../modules/folder/folder.admin-router.ts";
import { createGroupAdminRouter } from "../modules/group/group.admin-router.ts";

export const adminRouter = new Elysia({
    prefix: "/api/v1/admin",
})
    .use(createProfileAdminRouter())
    .use(createAuditLogAdminRouter())
    .use(createFolderAdminRouter())
    .use(createGroupAdminRouter());
