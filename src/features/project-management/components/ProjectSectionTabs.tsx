import { Link } from '@tanstack/react-router'
import { Briefcase, ClipboardList, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlanAccess } from '@/features/plan-management/hooks/usePlanAccess'
import {
  projectTabsListClassName,
  projectTabsTriggerClassName,
  projectTabsTriggerCompactClassName,
} from '@/features/project-management/components/ProjectManagementBackNav'
import { useProjectAccess } from '@/features/project-manager/hooks/useProjectAccess'
import { useGroupModuleAccess } from '@/features/project-management/hooks/useGroupModuleAccess'
import { cn } from '@/lib/utils/cn'

export type ProjectSectionTabT = 'projects' | 'plans' | 'groups'

type ProjectSectionTabItem = {
  id: ProjectSectionTabT
  to: '/app/project-manager' | '/app/plan-management' | '/app/groups'
  label: string
  icon: LucideIcon
}

export function useProjectSectionTabs(): Array<ProjectSectionTabItem> {
  const { t } = useTranslation('project-management')
  const { canViewProjects } = useProjectAccess()
  const { canViewProjectPlans } = usePlanAccess()
  const { canViewGroups } = useGroupModuleAccess()

  return useMemo(() => {
    const items: Array<ProjectSectionTabItem> = []

    if (canViewProjects) {
      items.push({
        id: 'projects',
        to: '/app/project-manager',
        label: t('sectionTabs.projects'),
        icon: Briefcase,
      })
    }
    if (canViewProjectPlans) {
      items.push({
        id: 'plans',
        to: '/app/plan-management',
        label: t('sectionTabs.plans'),
        icon: ClipboardList,
      })
    }
    if (canViewGroups) {
      items.push({
        id: 'groups',
        to: '/app/groups',
        label: t('sectionTabs.groups'),
        icon: UsersRound,
      })
    }

    return items
  }, [canViewProjects, canViewProjectPlans, canViewGroups, t])
}

export function ProjectSectionTabs({
  active,
  compact = false,
}: {
  active: ProjectSectionTabT
  compact?: boolean
}) {
  const tabs = useProjectSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  const triggerClassName = compact
    ? projectTabsTriggerCompactClassName
    : projectTabsTriggerClassName

  return (
    <nav
      className={projectTabsListClassName}
      aria-label="Project management sections"
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
