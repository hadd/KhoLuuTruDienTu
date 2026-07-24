import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

export type ArchiveWarehouseBreadcrumbSegment = {
  label: string
  onClick?: () => void
}

export function ArchiveWarehouseBreadcrumb({
  segments,
  className,
}: {
  segments: Array<ArchiveWarehouseBreadcrumbSegment>
  className?: string
}) {
  const { t } = useTranslation('archive-warehouse')

  if (segments.length === 0) {
    return (
      <nav
        aria-label={t('breadcrumb.aria')}
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-1 text-sm',
          className,
        )}
      >
        <span className="truncate font-medium text-foreground">
          {t('breadcrumb.root')}
        </span>
      </nav>
    )
  }

  return (
    <nav
      aria-label={t('breadcrumb.aria')}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1 text-sm',
        className,
      )}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        const isClickable = Boolean(segment.onClick) && !isLast

        return (
          <Fragment key={`${segment.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            ) : null}
            {isClickable ? (
              <button
                type="button"
                onClick={segment.onClick}
                className={cn(
                  'max-w-[12rem] truncate text-muted-foreground transition-colors hover:text-foreground sm:max-w-xs',
                )}
              >
                {segment.label}
              </button>
            ) : (
              <span
                className={cn(
                  'max-w-[12rem] truncate sm:max-w-xs',
                  isLast
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {segment.label}
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
