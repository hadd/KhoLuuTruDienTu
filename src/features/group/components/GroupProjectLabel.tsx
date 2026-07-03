import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

interface GroupProjectLabelProps {
  projectCode?: string | null
  projectName?: string | null
  className?: string
}

export function GroupProjectLabel({
  projectCode,
  projectName,
  className,
}: GroupProjectLabelProps) {
  const { t } = useTranslation('group')
  const code = projectCode?.trim()
  const displayName = projectName?.trim() || code || null

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {t('createDialog.fields.project.label')}
      </span>
      <span
        className="flex h-8 max-w-[200px] items-center truncate rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
        title={displayName ?? undefined}
      >
        {displayName ?? t('card.project.empty')}
      </span>
    </div>
  )
}
