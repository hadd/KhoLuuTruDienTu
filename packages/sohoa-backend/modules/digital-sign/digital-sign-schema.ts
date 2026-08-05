import { t } from "elysia";

export const visualSignatureSchema = t.Optional(
    t.Object({
        pageNumber: t.Optional(t.Number({ minimum: 1 })),
        xRatio: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        yRatio: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        widthPx: t.Optional(t.Number({ minimum: 50, maximum: 800 })),
        heightPx: t.Optional(t.Number({ minimum: 20, maximum: 400 })),
        /** Preferred: box size as % of page width/height, from the resizable
         * placement box drawn by the user in the PDF preview. */
        widthRatio: t.Optional(t.Number({ minimum: 5, maximum: 100 })),
        heightRatio: t.Optional(t.Number({ minimum: 2, maximum: 100 })),
        reason: t.Optional(t.String()),
        location: t.Optional(t.String()),
        appearanceType: t.Optional(t.String()),
        stampImageBase64: t.Optional(t.String()),
    }),
);

const prepareFileItemSchema = t.Object({
    fileId: t.String({ format: "uuid" }),
    visualSignature: visualSignatureSchema,
});

export const prepareDossierBodySchema = t.Object({
    dossierId: t.String({ format: "uuid" }),
    certificateSubject: t.Optional(t.String()),
    certificateIssuer: t.Optional(t.String()),
    /** Full certificate DER (base64) — lets the visual appearance render the
     * complete DN (C/O/L/CN/UID/E) exactly as encoded in the certificate. */
    certificateBase64: t.Optional(t.String()),
    visualSignature: visualSignatureSchema,
    /** When set, only these files are prepared (with optional per-file visual). */
    files: t.Optional(t.Array(prepareFileItemSchema, { minItems: 1 })),
    fileIds: t.Optional(t.Array(t.String({ format: "uuid" }), { minItems: 1 })),
});

export const prepareBatchBodySchema = t.Object({
    dossierIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
    certificateSubject: t.Optional(t.String()),
    certificateIssuer: t.Optional(t.String()),
    certificateBase64: t.Optional(t.String()),
    visualSignature: visualSignatureSchema,
    files: t.Optional(t.Array(prepareFileItemSchema, { minItems: 1 })),
    fileIds: t.Optional(t.Array(t.String({ format: "uuid" }), { minItems: 1 })),
});

export const submitSignatureBodySchema = t.Object({
    fileId: t.String({ format: "uuid" }),
    signatureBase64: t.String({ minLength: 1 }),
    certificateBase64: t.String({ minLength: 1 }),
    certificateSubject: t.String({ minLength: 1 }),
    certificateThumbprint: t.String({ minLength: 1 }),
    certificateIssuer: t.String({ minLength: 1 }),
    certificateValidFrom: t.Optional(t.String()),
    certificateValidTo: t.Optional(t.String()),
    visualSignature: visualSignatureSchema,
});

export const submitBatchSignatureBodySchema = submitSignatureBodySchema;

export type PrepareDossierBody = typeof prepareDossierBodySchema.static;
export type PrepareBatchBody = typeof prepareBatchBodySchema.static;
export type SubmitSignatureBody = typeof submitSignatureBodySchema.static;
