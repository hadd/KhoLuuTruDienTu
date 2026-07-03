import { Elysia, t } from "elysia";
import { ProjectPlanService as service } from "./project-plan-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createProjectPlanBodySchema,
    projectPlanIdParamSchema,
    updateProjectPlanBodySchema,
    bulkUpdatePlanDetailBodySchema,
} from "./types.ts";

export function createProjectPlanRouter(basePath: string = "/project-plans") {
    const tags = ["ProjectPlan"];

    const app = new Elysia({
        name: "projectPlanRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_READ);
            const scope = await projectAccessHelper.resolveScope(profile);
            let projectCode = urlQuery.projectCode || urlQuery.project_code;
            if (projectCode) {
                await projectAccessHelper.assertCanAccessProject(profile, projectCode);
            } else if (scope.type === "managed" && scope.projectCodes.length === 1) {
                projectCode = scope.projectCodes[0];
            }
            return await service.list({
                projectCode,
                projectCodes: scope.type === "managed" && !projectCode
                    ? scope.projectCodes
                    : undefined,
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
            query: t.Object({
                projectCode: t.Optional(t.String()),
                project_code: t.Optional(t.String()),
                limit: t.Optional(t.String()),
                offset: t.Optional(t.String()),
            }),
        },
    );

    app.post(
        "",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_CREATE);
            await projectAccessHelper.assertCanAccessProject(profile, body.projectCode);
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
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_READ);
            const plan = await service.get(params.id);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return plan;
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
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_UPDATE);
            const plan = await service.get(params.id);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
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
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_DELETE);
            const plan = await service.get(params.id);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
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

    app.get(
        "/:id/detail",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_READ);
            const plan = await service.get(params.id);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return await service.getDetails(params.id);
        },
        {
            params: projectPlanIdParamSchema,
            detail: {
                tags,
                summary: "Get project plan details",
            },
        },
    );

    app.put(
        "/:id/detail",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_UPDATE);
            const plan = await service.get(params.id);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return await service.bulkUpdateDetails(params.id, body);
        },
        {
            params: projectPlanIdParamSchema,
            body: bulkUpdatePlanDetailBodySchema,
            detail: {
                tags,
                summary: "Bulk update project plan details",
            },
        },
    );

    return app;
}
