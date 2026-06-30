import { t } from "elysia";

export const fondEntitySchema = t.Object({
    id: t.String(),
    fondName: t.String(),
    archiveAgency: t.String(),
    adminstrativeHistory: t.String(),
    fondType: t.String(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createFondSchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã phông (người dùng tự nhập)" }),
    fondName: t.String({ maxLength: 255 }),
    archiveAgency: t.String({ maxLength: 255 }),
    adminstrativeHistory: t.String(),
    fondType: t.String({ maxLength: 255 }),
});

export const updateFondSchema = t.Object({
    fondName: t.Optional(t.String({ maxLength: 255 })),
    archiveAgency: t.Optional(t.String({ maxLength: 255 })),
    adminstrativeHistory: t.Optional(t.String()),
    fondType: t.Optional(t.String({ maxLength: 255 })),
});
