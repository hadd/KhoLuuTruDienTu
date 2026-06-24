import { Elysia } from "elysia";
import { ProjectPlanService as service } from "./project-plan-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createProjectPlanBodySchema,
    projectPlanIdParamSchema,
    updateProjectPlanBodySchema,
} from "./types.ts";

export function createProjectPlanAdminRouter(basePath: string = "/project-plans") {
    const tags = ["Admin", "ProjectPlan"];

    const app = new Elysia({
        name: "projectPlanAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            return await service.list({
                projectCode: urlQuery.projectCode,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
            });
        },
        {
            detail: {
                tags,
                summary: "List project plans",
                description: "Optional projectCode query filters plans by project.",
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
            body: createProjectPlanBodySchema,
            detail: {
                tags,
                summary: "Create a project plan",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_READ);
            return await service.get(params.id);
        },
        {
            params: projectPlanIdParamSchema,
            detail: {
                tags,
                summary: "Get project plan by ID",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_UPDATE);
            return await service.update(params.id, body);
        },
        {
            params: projectPlanIdParamSchema,
            body: updateProjectPlanBodySchema,
            detail: {
                tags,
                summary: "Update project plan",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECTS_DELETE);
            return await service.delete(params.id);
        },
        {
            params: projectPlanIdParamSchema,
            detail: {
                tags,
                summary: "Soft delete project plan",
            },
        },
    );

    return app;
}
