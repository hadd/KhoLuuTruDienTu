import { FileText, List, Trash2, type LucideIcon } from 'lucide-react'

import type { ArchiveDisposalViewT } from '@/features/archive-warehouse/schemas'

export type ArchiveDisposalTabConfigItem = {
  value: ArchiveDisposalViewT
  icon: LucideIcon
  labelKey: 'disposal.subTabList' | 'disposal.subTabProposal' | 'disposal.subTabSoftDeleted'
  descriptionKey:
    | 'disposal.subTabListDescription'
    | 'disposal.subTabProposalDescription'
    | 'disposal.subTabSoftDeletedDescription'
}

export const ARCHIVE_DISPOSAL_TAB_CONFIG: Array<ArchiveDisposalTabConfigItem> = [
  {
    value: 'proposal',
    icon: FileText,
    labelKey: 'disposal.subTabProposal',
    descriptionKey: 'disposal.subTabProposalDescription',
  },
  {
    value: 'softDeleted',
    icon: Trash2,
    labelKey: 'disposal.subTabSoftDeleted',
    descriptionKey: 'disposal.subTabSoftDeletedDescription',
  },
  {
    value: 'list',
    icon: List,
    labelKey: 'disposal.subTabList',
    descriptionKey: 'disposal.subTabListDescription',
  },
]
