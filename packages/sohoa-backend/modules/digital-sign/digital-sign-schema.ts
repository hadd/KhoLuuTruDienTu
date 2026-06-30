import { t } from "elysia";

export const prepareDossierBodySchema = t.Object({
    dossierId: t.String({ format: "uuid" }),
});

export const prepareBatchBodySchema = t.Object({
    dossierIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
});

export const submitSignatureBodySchema = t.Object({
    fileId: t.String({ format: "uuid" }),
    signatureBase64: t.String({ minLength: 1 }),
    certificateSubject: t.String({ minLength: 1 }),
    certificateThumbprint: t.String({ minLength: 1 }),
    certificateIssuer: t.String({ minLength: 1 }),
    certificateValidFrom: t.Optional(t.String()),
    certificateValidTo: t.Optional(t.String()),
});

export const submitBatchSignatureBodySchema = submitSignatureBodySchema;

export type PrepareDossierBody = typeof prepareDossierBodySchema.static;
export type PrepareBatchBody = typeof prepareBatchBodySchema.static;
export type SubmitSignatureBody = typeof submitSignatureBodySchema.static;
