import { t } from "elysia";

export const projectPlanEntitySchema = t.Object({
    id: t.String({ format: "uuid" }),
    name: t.String(),
    projectCode: t.String(),
    dossierCount: t.Number(),
    startDate: t.String(),
    endDate: t.String(),
    dateCount: t.Number(),
    isActive: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createProjectPlanBodySchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 255 }),
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
    dossierCount: t.Optional(t.Integer({ minimum: 0 })),
    startDate: t.String(),
    endDate: t.String(),
    dateCount: t.Optional(t.Integer({ minimum: 0 })),
    isActive: t.Optional(t.Boolean()),
});

export const updateProjectPlanBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    dossierCount: t.Optional(t.Integer({ minimum: 0 })),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
    dateCount: t.Optional(t.Integer({ minimum: 0 })),
    isActive: t.Optional(t.Boolean()),
});

export const projectPlanIdParamSchema = t.Object({
    id: t.String({ format: "uuid" }),
});

export const planDetailEntitySchema = t.Object({
    id: t.String({ format: "uuid" }),
    planId: t.String({ format: "uuid" }),
    taskName: t.String(),
    quantity: t.Number(),
    unit: t.String(),
    quota: t.Number(),
    dateCount: t.Number(),
    workerCount: t.Number(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const bulkUpdatePlanDetailBodySchema = t.Object({
    details: t.Array(t.Object({
        id: t.Optional(t.String({ format: "uuid" })),
        taskName: t.String({ minLength: 1, maxLength: 255 }),
        quantity: t.Optional(t.Integer({ minimum: 0 })),
        unit: t.String({ minLength: 1, maxLength: 50 }),
        quota: t.Optional(t.Integer({ minimum: 0 })),
        dateCount: t.Optional(t.Integer({ minimum: 0 })),
        workerCount: t.Optional(t.Integer({ minimum: 0 })),
    }))
});
