import { t } from "elysia";

export const fondEntitySchema = t.Object({
    id: t.String(),
    fondName: t.String(),
    archiveAgency: t.String(),
    adminstrativeHistory: t.String(),
    fondType: t.String(),
    isActive: t.Boolean(),
    hasZipPassword: t.Boolean(),
    zipPasswordEnabled: t.Boolean(),
    dossierCount: t.Optional(t.Number()),
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
    isActive: t.Optional(t.Boolean()),
    zipPasswordEnabled: t.Optional(t.Boolean()),
    /** Plain ZIP password for watermark downloads; stored encrypted. */
    zipPassword: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 128 }))),
});

export const updateFondSchema = t.Object({
    fondName: t.Optional(t.String({ maxLength: 255 })),
    archiveAgency: t.Optional(t.String({ maxLength: 255 })),
    adminstrativeHistory: t.Optional(t.String()),
    fondType: t.Optional(t.String({ maxLength: 255 })),
    isActive: t.Optional(t.Boolean()),
    zipPasswordEnabled: t.Optional(t.Boolean()),
    /**
     * Omit = keep existing password.
     * null or "" = clear password.
     * non-empty string = set new password.
     */
    zipPassword: t.Optional(t.Nullable(t.String({ maxLength: 128 }))),
});
