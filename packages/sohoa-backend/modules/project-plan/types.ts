import { t } from "elysia";

export const projectPlanEntitySchema = t.Object({
    id: t.String({ format: "uuid" }),
    name: t.String(),
    projectCode: t.String(),
    a4Pages: t.Number(),
    a3Pages: t.Number(),
    dossierCount: t.Number(),
    quota: t.Union([t.String(), t.Null()]),
    startDate: t.String(),
    endDate: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createProjectPlanBodySchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 255 }),
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
    a4Pages: t.Optional(t.Integer({ minimum: 0 })),
    a3Pages: t.Optional(t.Integer({ minimum: 0 })),
    dossierCount: t.Optional(t.Integer({ minimum: 0 })),
    quota: t.Optional(t.Union([t.String(), t.Null()])),
    startDate: t.String(),
    endDate: t.String(),
});

export const updateProjectPlanBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    a4Pages: t.Optional(t.Integer({ minimum: 0 })),
    a3Pages: t.Optional(t.Integer({ minimum: 0 })),
    dossierCount: t.Optional(t.Integer({ minimum: 0 })),
    quota: t.Optional(t.Union([t.String(), t.Null()])),
    startDate: t.Optional(t.String()),
    endDate: t.Optional(t.String()),
});

export const projectPlanIdParamSchema = t.Object({
    id: t.String({ format: "uuid" }),
});
