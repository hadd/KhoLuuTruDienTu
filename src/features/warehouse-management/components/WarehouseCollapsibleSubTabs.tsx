import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type WarehouseCollapsibleSubTabsProps = {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  visible: boolean
  children: ReactNode
  className?: string
}

export function WarehouseCollapsibleSubTabs({
  expanded,
  onExpandedChange,
  visible,
  children,
  className,
}: WarehouseCollapsibleSubTabsProps) {
  const { t } = useTranslation('warehouse-management')

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-end gap-0.5 border-b border-border/70 pb-px',
        className,
      )}
    >
      {expanded ? (
        <div className="flex min-w-0 flex-col gap-0.5 overflow-visible">
          {children}
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mb-px size-7 shrink-0 text-muted-foreground"
        aria-label={expanded ? t('subTabs.hide') : t('subTabs.show')}
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  )
}
