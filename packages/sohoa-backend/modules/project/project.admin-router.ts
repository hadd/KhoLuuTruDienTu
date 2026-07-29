import { Elysia } from "elysia";
import { httpError } from "@shared/common-lib";
import { ProjectService as service } from "./project-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import {
    Permission,
    PROJECT_SELECTION_READ_PERMISSIONS,
} from "../auth/permission-catalog.ts";
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
    }).use(plugins.authProfile).use(plugins.urlQuery).use(plugins.auditLog);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            const scope = await projectAccessHelper.resolveScope(profile);
            return await service.list({
                status: urlQuery.status,
                search: urlQuery.search,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                page: urlQuery.page ? Number(urlQuery.page) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
                projectCodes: scope.type === "managed"
                    ? scope.projectCodes
                    : undefined,
            });
        },
        {
            detail: {
                tags,
                summary: "List projects",
            },
        },
    );

    app.get(
        "/options",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermissionAny(profile, PROJECT_SELECTION_READ_PERMISSIONS);
            const scope = await projectAccessHelper.resolveScope(profile);
            return await service.listOptions({
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
                projectCodes: scope.type === "managed"
                    ? scope.projectCodes
                    : undefined,
            });
        },
        {
            detail: {
                tags,
                summary: "List project options for selection dropdowns",
                description:
                    "Returns lightweight project code/name pairs for screens such as data management, plan management, and scan intake. Does not require projects.read.",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_CREATE);
            const scope = await projectAccessHelper.resolveScope(profile);
            if (scope.type === "managed") {
                if (body.managerId && body.managerId !== profile.id) {
                    throw httpError.badRequest(
                        "You can only assign yourself as project manager when creating a project",
                    );
                }
                return await service.create(body, { actorManagerId: profile.id });
            }
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
        "/:projectCode",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            await projectAccessHelper.assertCanAccessProject(profile, params.projectCode);
            return await service.get(params.projectCode);
        },
        {
            params: projectCodeParamSchema,
            detail: {
                tags,
                summary: "Get project detail",
            },
        },
    );

    app.get(
        "/:projectCode/progress-history",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            await projectAccessHelper.assertCanAccessProject(profile, params.projectCode);
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
            await projectAccessHelper.assertCanAccessProject(profile, params.projectCode);
            const allowManagerChange = projectAccessHelper.hasGlobalProjectScope(profile);
            return await service.update(
                params.projectCode,
                body,
                profile.id,
                { allowManagerChange },
            );
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
            await projectAccessHelper.assertCanAccessProject(profile, params.projectCode);
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
