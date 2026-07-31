import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Send,
  Settings2,
  Shield,
  type LucideIcon,
} from 'lucide-react'

import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'

export type ArchiveDataHubTabConfigItem = {
  value: ArchiveDataHubTabT
  icon: LucideIcon
  labelKey:
    | 'tabs.dossiers'
    | 'tabs.expiryReview'
    | 'tabs.submission'
    | 'tabs.review'
    | 'tabs.config'
    | 'tabs.permission'
  descriptionKey:
    | 'hubNav.dossiersDescription'
    | 'hubNav.expiryReviewDescription'
    | 'hubNav.submissionDescription'
    | 'hubNav.reviewDescription'
    | 'hubNav.configDescription'
    | 'hubNav.permissionDescription'
}

export const ARCHIVE_DATA_HUB_TAB_CONFIG: Array<ArchiveDataHubTabConfigItem> = [
  {
    value: 'dossiers',
    icon: FolderOpen,
    labelKey: 'tabs.dossiers',
    descriptionKey: 'hubNav.dossiersDescription',
  },
  {
    value: 'expiryReview',
    icon: AlertTriangle,
    labelKey: 'tabs.expiryReview',
    descriptionKey: 'hubNav.expiryReviewDescription',
  },
  {
    value: 'submission',
    icon: Send,
    labelKey: 'tabs.submission',
    descriptionKey: 'hubNav.submissionDescription',
  },
  {
    value: 'review',
    icon: CheckCircle2,
    labelKey: 'tabs.review',
    descriptionKey: 'hubNav.reviewDescription',
  },
  {
    value: 'config',
    icon: Settings2,
    labelKey: 'tabs.config',
    descriptionKey: 'hubNav.configDescription',
  },
  {
    value: 'permission',
    icon: Shield,
    labelKey: 'tabs.permission',
    descriptionKey: 'hubNav.permissionDescription',
  },
]
