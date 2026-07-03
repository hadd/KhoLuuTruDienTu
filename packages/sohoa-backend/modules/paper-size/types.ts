import { t } from "elysia";

// --- Paper Size ---

export const paperSizeEntitySchema = t.Object({
    id: t.String({ format: "uuid" }),
    name: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createPaperSizeBodySchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 50 }),
});

export const updatePaperSizeBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
});

export const paperSizeIdParamSchema = t.Object({
    id: t.String({ format: "uuid" }),
});

// --- Paper Plan ---

export const paperPlanEntitySchema = t.Object({
    id: t.String({ format: "uuid" }),
    planId: t.String({ format: "uuid" }),
    paperSizeId: t.String({ format: "uuid" }),
    quantity: t.Number(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    
    // Optional relations for presentation
    paperSize: t.Optional(t.Object({
        id: t.String(),
        name: t.String(),
    })),
});

export const createPaperPlanBodySchema = t.Object({
    planId: t.String({ format: "uuid" }),
    paperSizeId: t.String({ format: "uuid" }),
    quantity: t.Integer({ minimum: 0 }),
});

export const updatePaperPlanBodySchema = t.Object({
    quantity: t.Optional(t.Integer({ minimum: 0 })),
});

export const paperPlanIdParamSchema = t.Object({
    id: t.String({ format: "uuid" }),
});
