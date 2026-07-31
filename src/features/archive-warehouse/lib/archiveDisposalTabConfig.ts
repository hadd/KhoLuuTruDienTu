import { List, Trash2, type LucideIcon } from 'lucide-react'

import type { ArchiveDisposalViewT } from '@/features/archive-warehouse/schemas'

export type ArchiveDisposalTabConfigItem = {
  value: ArchiveDisposalViewT
  icon: LucideIcon
  labelKey: 'disposal.subTabList' | 'disposal.subTabProposal'
  descriptionKey:
    | 'disposal.subTabListDescription'
    | 'disposal.subTabProposalDescription'
}

export const ARCHIVE_DISPOSAL_TAB_CONFIG: Array<ArchiveDisposalTabConfigItem> = [
  {
    value: 'list',
    icon: List,
    labelKey: 'disposal.subTabList',
    descriptionKey: 'disposal.subTabListDescription',
  },
  {
    value: 'proposal',
    icon: Trash2,
    labelKey: 'disposal.subTabProposal',
    descriptionKey: 'disposal.subTabProposalDescription',
  },
]
