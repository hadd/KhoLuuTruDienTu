/**
 * Shared validation types and patterns for API route parameters
 * 
 * This module provides reusable type definitions and regex patterns
 * for validating common ID formats (UUID, numeric IDs, etc.)
 */

import { t } from "elysia";

/**
 * UUID v4 format regex pattern
 * Matches: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Numeric ID regex pattern (positive integers only)
 * Matches: 1, 42, 12345, etc.
 */
export const NUMERIC_ID_REGEX = /^\d+$/;

/**
 * Combined UUID or Numeric ID regex pattern
 * Matches either UUID format or positive integer
 */
export const UUID_OR_NUMERIC_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/**
 * Elysia type schema for UUID parameters
 * 
 * @example
 * ```typescript
 * params: t.Object({ 
 *   userId: UuidParam("User ID")
 * })
 * ```
 */
export const UuidParam = (description?: string) => t.String({
    pattern: UUID_REGEX.source,
    description: description || "UUID identifier",
    examples: ["550e8400-e29b-41d4-a716-446655440000"]
});

/**
 * Elysia type schema for numeric ID parameters
 * 
 * @example
 * ```typescript
 * params: t.Object({ 
 *   userId: NumericIdParam("User ID")
 * })
 * ```
 */
export const NumericIdParam = (description?: string) => t.String({
    pattern: NUMERIC_ID_REGEX.source,
    description: description || "Numeric identifier",
    examples: ["1", "42", "12345"]
});

/**
 * Elysia type schema for parameters that accept either UUID or numeric ID
 * 
 * @example
 * ```typescript
 * params: t.Object({ 
 *   userId: IdParam("User ID")
 * })
 * ```
 */
export const IdParam = (description?: string) => t.String({
    pattern: UUID_OR_NUMERIC_REGEX.source,
    description: description || "UUID or numeric identifier",
    examples: ["550e8400-e29b-41d4-a716-446655440000", "42"]
});

/**
 * Validation helper: Check if a string is a valid UUID
 */
export function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

/**
 * Validation helper: Check if a string is a valid numeric ID
 */
export function isNumericId(value: string): boolean {
    return NUMERIC_ID_REGEX.test(value);
}

/**
 * Validation helper: Check if a string is either a UUID or numeric ID
 */
export function isValidId(value: string): boolean {
    return UUID_OR_NUMERIC_REGEX.test(value);
}
export type UuidString = string & { __brand: "uuid" };
export type NumericIdString = string & { __brand: "numericId" };
export type IdString = UuidString | NumericIdString;

