import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { dataManagementProjectsQueryOptions } from '@/features/data-management/queries'
import { cn } from '@/lib/utils/cn'

interface GroupProjectLabelProps {
  projectCode?: string | null
  className?: string
}

export function GroupProjectLabel({
  projectCode,
  className,
}: GroupProjectLabelProps) {
  const { t } = useTranslation('group')
  const { data, isPending } = useQuery(dataManagementProjectsQueryOptions())

  const displayName = useMemo(() => {
    const code = projectCode?.trim()
    if (!code) return null
    return (
      data?.items.find((project) => project.projectCode === code)
        ?.projectName ?? code
    )
  }, [data?.items, projectCode])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {t('createDialog.fields.project.label')}
      </span>
      <span
        className="flex h-8 max-w-[200px] items-center truncate rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
        title={displayName ?? undefined}
      >
        {isPending && projectCode?.trim()
          ? t('card.project.loading')
          : (displayName ?? t('card.project.empty'))}
      </span>
    </div>
  )
}
