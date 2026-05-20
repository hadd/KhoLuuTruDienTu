/**
 * Branded Types for Type Safety
 * These types prevent accidental mixing of different ID types
 */

export type Brand<K, T> = K & { readonly __brand: T };

// Core ID Types (using Snowflake IDs - 64-bit integers stored as bigint/string)
// Snowflake IDs are: sortable, time-based, distributed, and more compact than UUIDs
export type UserId = Brand<string, 'User'>;
export type RoleId = Brand<string, 'Role'>;
export type ApiKeyId = Brand<string, 'ApiKey'>;
export type GroupId = Brand<string, 'Group'>;
export type FolderId = Brand<string, 'Folder'>;
export type DossierId = Brand<string, 'Dossier'>;
export type DossierFileId = Brand<string, 'DossierFile'>;
export type AssignmentId = Brand<string, 'Assignment'>;
export type WorkflowLogId = Brand<string, 'WorkflowLog'>;

// Additional Status Types (not in enums.ts)
export type AuthProvider = 'native' | 'google' | 'facebook';
// Note: QuestionType is now exported from enums.ts, not here
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type GroupMemberRole = 'admin' | 'moderator' | 'member';

