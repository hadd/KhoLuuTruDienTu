import { t } from "elysia";

export const dossierTypeEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createDossierTypeSchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã loại hồ sơ" }),
    name: t.String({ maxLength: 255 }),
    description: t.Optional(t.String()),
});

export const updateDossierTypeSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255 })),
    description: t.Optional(t.String()),
});
