import { Link } from '@tanstack/react-router'
import { Briefcase, ClipboardList, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlanAccess } from '@/features/plan-management/hooks/usePlanAccess'
import { useGroupModuleAccess } from '@/features/project-management/hooks/useGroupModuleAccess'
import { useProjectAccess } from '@/features/project-manager/hooks/useProjectAccess'
import {
  IconHubPageLayout,
  iconHubNestedTileGridClassName,
  iconHubNestedTileGridGapClassName,
  iconHubNestedTileIconClassName,
  iconHubNestedTileIconWrapClassName,
  iconHubNestedTileLabelClassName,
  iconHubNestedTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
import { cn } from '@/lib/utils/cn'

type ProjectTileTo =
  | '/app/project-manager'
  | '/app/plan-management'
  | '/app/groups'

export function ProjectManagementPage() {
  const { t } = useTranslation('project-management')
  const { t: tCommon } = useTranslation('common')
  const { canViewProjects } = useProjectAccess()
  const { canViewProjectPlans } = usePlanAccess()
  const { canViewGroups } = useGroupModuleAccess()

  const tiles = useMemo(() => {
    const items: Array<{
      id: string
      to: ProjectTileTo
      label: string
      icon: LucideIcon
    }> = []

    if (canViewProjects) {
      items.push({
        id: 'projects',
        to: '/app/project-manager',
        label: t('tiles.projects'),
        icon: Briefcase,
      })
    }
    if (canViewProjectPlans) {
      items.push({
        id: 'plans',
        to: '/app/plan-management',
        label: t('tiles.plans'),
        icon: ClipboardList,
      })
    }
    if (canViewGroups) {
      items.push({
        id: 'groups',
        to: '/app/groups',
        label: t('tiles.groups'),
        icon: UsersRound,
      })
    }

    return items
  }, [canViewProjects, canViewProjectPlans, canViewGroups, t])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('noPermission')}
      </div>
    )
  }

  return (
    <IconHubPageLayout
      title={t('title')}
      maxWidth="max-w-6xl"
      back={{
        to: '/app/digitization-hub',
        parentLabel: tCommon('admin.groups.digitization'),
        backAriaLabel: tCommon('hubBack.aria', {
          target: tCommon('admin.groups.digitization'),
        }),
      }}
    >
      <div
        className={cn(
          iconHubNestedTileGridClassName,
          iconHubNestedTileGridGapClassName,
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className={iconHubNestedTileLinkClassName}
            >
              <span className={iconHubNestedTileIconWrapClassName}>
                <Icon
                  className={iconHubNestedTileIconClassName}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className={iconHubNestedTileLabelClassName}>
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
