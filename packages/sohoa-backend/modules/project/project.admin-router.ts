import { Elysia } from "elysia";
import { ProjectService as service } from "./project-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createProjectBodySchema,
    projectCodeParamSchema,
    updateProjectBodySchema,
} from "./types.ts";

export function createProjectAdminRouter(basePath: string = "/projects") {
    const tags = ["Admin", "Project"];

    const app = new Elysia({
        name: "projectAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            return await service.list({
                status: urlQuery.status,
                search: urlQuery.search,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
            });
        },
        {
            detail: {
                tags,
                summary: "List projects",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_CREATE);
            return await service.create(body);
        },
        {
            body: createProjectBodySchema,
            detail: {
                tags,
                summary: "Create a project",
            },
        },
    );

    app.get(
        "/:projectCode/progress-history",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            return await service.listProgressHistory(params.projectCode);
        },
        {
            params: projectCodeParamSchema,
            detail: {
                tags,
                summary: "List project progress history",
            },
        },
    );

    app.patch(
        "/:projectCode",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_UPDATE);
            return await service.update(params.projectCode, body, profile.id);
        },
        {
            params: projectCodeParamSchema,
            body: updateProjectBodySchema,
            detail: {
                tags,
                summary: "Update project",
                description:
                    "When acceptanceDate changes, changeReason is required and a progress history record is created.",
            },
        },
    );

    app.delete(
        "/:projectCode",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_DELETE);
            return await service.delete(params.projectCode);
        },
        {
            params: projectCodeParamSchema,
            detail: {
                tags,
                summary: "Soft delete project",
            },
        },
    );

    return app;
}
