import { Link } from '@tanstack/react-router'
import { FolderTree, ScanLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useDataManagementHubAccess } from '@/features/digitization/hooks/useDataManagementHubAccess'
import { useScanIntakeAccess } from '@/features/digitization/hooks/useScanIntakeAccess'
import {
  digitizationTabsListClassName,
  digitizationTabsTriggerClassName,
  digitizationTabsTriggerCompactClassName,
} from '@/features/digitization/components/DigitizationBackNav'
import { cn } from '@/lib/utils/cn'

export type DigitizationSectionTabT = 'scan' | 'data'

type DigitizationSectionTabItem = {
  id: DigitizationSectionTabT
  to: '/app/scan-intake' | '/app/data'
  label: string
  icon: LucideIcon
}

export function useDigitizationSectionTabs(): Array<DigitizationSectionTabItem> {
  const { t } = useTranslation('digitization')
  const { canUseScanIntake } = useScanIntakeAccess()
  const { canViewDataManagement } = useDataManagementHubAccess()

  return useMemo(() => {
    const items: Array<DigitizationSectionTabItem> = []

    if (canUseScanIntake) {
      items.push({
        id: 'scan',
        to: '/app/scan-intake',
        label: t('sectionTabs.scanIntake'),
        icon: ScanLine,
      })
    }
    if (canViewDataManagement) {
      items.push({
        id: 'data',
        to: '/app/data',
        label: t('sectionTabs.dataManagement'),
        icon: FolderTree,
      })
    }

    return items
  }, [canUseScanIntake, canViewDataManagement, t])
}

export function DigitizationSectionTabs({
  active,
  compact = false,
}: {
  active: DigitizationSectionTabT
  compact?: boolean
}) {
  const tabs = useDigitizationSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  const triggerClassName = compact
    ? digitizationTabsTriggerCompactClassName
    : digitizationTabsTriggerClassName

  return (
    <nav
      className={cn(digitizationTabsListClassName, 'shrink-0')}
      aria-label="Digitization sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(triggerClassName, 'inline-flex items-center')}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
