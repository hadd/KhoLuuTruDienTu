import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ArchiveBorrowApprovalClearanceService } from "./archive-borrow-approval-clearance-service.ts";

export function createArchiveBorrowApprovalClearanceAdminRouter(
    basePath = "/archive-borrow-approval-clearances",
) {
    const tags = ["Admin", "ArchiveBorrowApprovalClearance"];

    const app = new Elysia({
        name: "archiveBorrowApprovalClearanceAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(
                profile,
                Permission.LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE,
            );
            return await ArchiveBorrowApprovalClearanceService.getCatalog();
        },
        {
            detail: {
                tags,
                summary: "List borrow approval clearance mappings",
            },
        },
    );

    app.put(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(
                profile,
                Permission.LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE,
            );
            return await ArchiveBorrowApprovalClearanceService.replaceAll(
                body.items,
            );
        },
        {
            body: t.Object({
                items: t.Array(
                    t.Object({
                        roleId: t.String({ minLength: 1 }),
                        maxSecurityLevelId: t.String({ format: "uuid" }),
                    }),
                ),
            }),
            detail: {
                tags,
                summary: "Replace all borrow approval clearance mappings",
            },
        },
    );

    app.delete(
        "/:roleId",
        async ({ params, profile }) => {
            authHelper.checkPermission(
                profile,
                Permission.LIBRARY_BORROW_APPROVAL_CONFIG_MANAGE,
            );
            await ArchiveBorrowApprovalClearanceService.deleteByRoleId(
                params.roleId,
            );
            return { ok: true };
        },
        {
            params: t.Object({
                roleId: t.String({ minLength: 1 }),
            }),
            detail: {
                tags,
                summary: "Delete borrow approval clearance for a role",
            },
        },
    );

    return app;
}
