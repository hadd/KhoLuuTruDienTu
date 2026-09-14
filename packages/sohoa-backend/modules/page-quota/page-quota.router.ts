import { Elysia, t } from "elysia";
import { httpError } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { AuthRole, authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    applyPageLicense,
    checkUploadPages,
    getPageQuotaView,
} from "./page-quota-service.ts";

export function createPageQuotaRouter(basePath: string = "/page-quota") {
    const tags = ["PageQuota"];

    return new Elysia({ name: "pageQuotaRouter", prefix: basePath })
        .use(plugins.authProfile)
        .use(plugins.auditLog)
        .get(
            "",
            async ({ profile }) => {
                authHelper.checkRoleAny(profile, [AuthRole.ADMIN]);
                return await getPageQuotaView();
            },
            {
                detail: {
                    tags,
                    summary: "Get extract page quota (admin only)",
                },
            },
        )
        .post(
            "/check-upload",
            async ({ body, profile }) => {
                authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
                return await checkUploadPages(body.pages);
            },
            {
                body: t.Object({
                    pages: t.Number({ minimum: 0 }),
                }),
                detail: {
                    tags,
                    summary: "Check if an upload batch page total fits remaining quota",
                },
            },
        )
        .post(
            "/license",
            async ({ body, profile }) => {
                authHelper.checkRoleAny(profile, [AuthRole.ADMIN]);
                let raw: unknown;
                try {
                    const buf = await body.file.arrayBuffer();
                    const text = new TextDecoder().decode(buf);
                    raw = JSON.parse(text);
                } catch {
                    throw httpError.badRequest("File license phải là JSON .lic");
                }
                return await applyPageLicense(raw, profile.id);
            },
            {
                body: t.Object({
                    file: t.File(),
                }),
                detail: {
                    tags,
                    summary: "Apply signed page-quota license file",
                },
            },
        );
}
