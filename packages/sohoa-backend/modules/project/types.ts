import { t } from "elysia";
import { PROJECT_STATUS_VALUES } from "../../db/schemas/project-constants.ts";

export const projectStatusSchema = t.Union(
    PROJECT_STATUS_VALUES.map((value) => t.Literal(value)),
);

export const projectEntitySchema = t.Object({
    projectCode: t.String(),
    projectName: t.String(),
    projectType: t.Union([t.String(), t.Null()]),
    investor: t.Union([t.String(), t.Null()]),
    startDate: t.Union([t.String(), t.Null()]),
    acceptanceDate: t.Union([t.String(), t.Null()]),
    totalInvestment: t.Union([t.String(), t.Null()]),
    status: projectStatusSchema,
    managerId: t.Union([t.String(), t.Null()]),
    managerName: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createProjectBodySchema = t.Object({
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
    projectName: t.String({ minLength: 1, maxLength: 255 }),
    projectType: t.Optional(t.String({ maxLength: 100 })),
    investor: t.Optional(t.String()),
    startDate: t.Optional(t.String()),
    acceptanceDate: t.Optional(t.String()),
    totalInvestment: t.Optional(t.String()),
    status: t.Optional(projectStatusSchema),
    managerId: t.Optional(t.String({ format: "uuid" })),
});

export const updateProjectBodySchema = t.Object({
    projectName: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    projectType: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
    investor: t.Optional(t.Union([t.String(), t.Null()])),
    startDate: t.Optional(t.Union([t.String(), t.Null()])),
    acceptanceDate: t.Optional(t.Union([t.String(), t.Null()])),
    totalInvestment: t.Optional(t.Union([t.String(), t.Null()])),
    status: t.Optional(projectStatusSchema),
    changeReason: t.Optional(t.String({ minLength: 1 })),
    managerId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
});

export const projectCodeParamSchema = t.Object({
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
});

export const projectProgressHistorySchema = t.Object({
    id: t.String(),
    projectCode: t.String(),
    extensionNumber: t.Number(),
    previousAcceptanceDate: t.Union([t.String(), t.Null()]),
    newAcceptanceDate: t.String(),
    changeReason: t.String(),
    updatedBy: t.String(),
    recordedAt: t.Union([t.Date(), t.Null()]),
});
