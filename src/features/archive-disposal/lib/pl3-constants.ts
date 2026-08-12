import type { Pl3ContentT } from '@/features/archive-disposal/types'

export const PL3_REQUIRED_FORMATION_KEYS = [
  'creatingAgency',
  'formationMission',
  'collectionSource',
  'timePeriod',
  'expiryDuplicateReason',
  'priorValuation',
] as const satisfies ReadonlyArray<keyof Pl3ContentT>
