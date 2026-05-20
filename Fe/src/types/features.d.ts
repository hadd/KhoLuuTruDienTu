/**
 * Central re-export hub for all feature types.
 * This file makes all feature types discoverable for AI agents and provides
 * a single import point for routes and shared components.
 *
 * Types are organized by feature domain in `features/{domain}/types.d.ts`.
 * This file re-exports them for convenience and discoverability.
 */

// Auth types
export type { UserT } from '@/features/auth/types'
