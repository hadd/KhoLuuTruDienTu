import { t, type TSchema } from "elysia";

/**
 * Runtime schema fragment for audit fields to compose into request/response schemas.
 * Both fields are nullable strings (UUIDs are represented as strings at runtime).
 */
export const auditSchema = t.Object({
    createdById: t.Union([t.Null(), t.String()]),
    updatedById: t.Union([t.Null(), t.String()]),
});

/**
 * Helper to extend an object schema with audit fields.
 */
export function withAudit<T extends Record<string, TSchema>>(shape: T) {
    return t.Object({
        ...shape,
        createdById: t.Union([t.Null(), t.String()]),
        updatedById: t.Union([t.Null(), t.String()]),
    });
}



