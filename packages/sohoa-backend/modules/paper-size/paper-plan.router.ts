import { Elysia } from "elysia";
import { PaperPlanService as service } from "./paper-plan-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createPaperPlanBodySchema,
    paperPlanIdParamSchema,
    updatePaperPlanBodySchema,
} from "./types.ts";
import { ProjectPlanService } from "../project-plan/project-plan-service.ts";
import { t } from "elysia";

export function createPaperPlanRouter(basePath: string = "/paper-plans") {
    const tags = ["PaperPlan"];

    const app = new Elysia({
        name: "paperPlanRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_READ);
            const planId = urlQuery.planId;
            if (planId) {
                const plan = await ProjectPlanService.get(planId);
                await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            }
            return await service.list({
                planId,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
            });
        },
        {
            detail: { tags, summary: "List paper plans" },
            query: t.Object({
                planId: t.Optional(t.String()),
                limit: t.Optional(t.String()),
                offset: t.Optional(t.String()),
            })
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_READ);
            
            // Ở đây :id được hiểu là planId (mã của kế hoạch)
            const planId = params.id;
            
            // Check quyền truy cập vào project của plan này
            const plan = await ProjectPlanService.get(planId);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            
            // Trả về danh sách khổ giấy thuộc về planId này
            return await service.list({ planId });
        },
        {
            params: paperPlanIdParamSchema,
            detail: { tags, summary: "Get paper plans by planId" },
        },
    );

    app.post(
        "",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_CREATE);
            const plan = await ProjectPlanService.get(body.planId);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return await service.create(body);
        },
        {
            body: createPaperPlanBodySchema,
            detail: { tags, summary: "Create a paper plan" },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_UPDATE);
            const paperPlan = await service.get(params.id);
            const plan = await ProjectPlanService.get(paperPlan.planId);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return await service.update(params.id, body);
        },
        {
            params: paperPlanIdParamSchema,
            body: updatePaperPlanBodySchema,
            detail: { tags, summary: "Update paper plan quantity" },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PROJECT_PLANS_DELETE);
            const paperPlan = await service.get(params.id);
            const plan = await ProjectPlanService.get(paperPlan.planId);
            await projectAccessHelper.assertCanAccessProject(profile, plan.projectCode);
            return await service.delete(params.id);
        },
        {
            params: paperPlanIdParamSchema,
            detail: { tags, summary: "Soft delete paper plan" },
        },
    );

    return app;
}
