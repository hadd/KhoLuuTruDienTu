import type { DisposalCouncilMemberInputT } from '@/features/archive-disposal-council/types'

export function emptyCouncilMemberRow(index: number): DisposalCouncilMemberInputT {
  return {
    userId: '',
    positionRole: index === 0 ? 'CHAIR' : 'MEMBER',
    representationType:
      index === 1 ? 'ARCHIVE_DEPT' : index === 2 ? 'SPECIALIST_DEPT' : 'OTHER',
    sortOrder: index,
  }
}

export function createDefaultCouncilMemberRows(): Array<DisposalCouncilMemberInputT> {
  return Array.from({ length: 5 }, (_, index) => emptyCouncilMemberRow(index))
}
