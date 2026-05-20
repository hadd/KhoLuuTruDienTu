/**
 * Global type definitions - Re-export hub for backward compatibility.
 *
 * This file re-exports all feature types from the centralized features.d.ts file.
 * This maintains backward compatibility with existing imports:
 *   import type { StudentT } from '@/types/common'
 *
 * For new code, you can import directly from feature types:
 *   import type { StudentT } from '@/features/students/types'
 *
 * Or use the centralized features export:
 *   import type { StudentT } from '@/types/features'
 *
 * Types are organized by feature domain in `features/{domain}/types.d.ts`.
 * See `features.d.ts` for the complete list of available types.
 */

// Re-export all types from features.d.ts for backward compatibility
export type {
  // Auth
  UserT,
} from './features'
