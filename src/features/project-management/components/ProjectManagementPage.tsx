import { Link } from '@tanstack/react-router'
import { Briefcase, ClipboardList, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlanAccess } from '@/features/plan-management/hooks/usePlanAccess'
import { useGroupModuleAccess } from '@/features/project-management/hooks/useGroupModuleAccess'
import { useProjectAccess } from '@/features/project-manager/hooks/useProjectAccess'
import { IconHubPageLayout } from '@/features/navigation/components/IconHubPageLayout'
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
      maxWidth={tiles.length <= 2 ? 'max-w-3xl' : 'max-w-5xl'}
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
          'grid w-full gap-8 sm:gap-10',
          tiles.length === 1
            ? 'max-w-xs grid-cols-1'
            : tiles.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className="group flex flex-col items-center gap-4 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-36 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-44">
                <Icon
                  className="size-16 sm:size-20"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className="text-center text-lg font-medium text-foreground transition-colors group-hover:text-primary sm:text-xl">
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
