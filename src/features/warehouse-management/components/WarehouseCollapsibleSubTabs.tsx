import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type WarehouseCollapsibleSubTabsToggleProps = {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  className?: string
}

export function WarehouseCollapsibleSubTabsToggle({
  expanded,
  onExpandedChange,
  className,
}: WarehouseCollapsibleSubTabsToggleProps) {
  const { t } = useTranslation('warehouse-management')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'mb-px size-9 shrink-0 text-muted-foreground',
        className,
      )}
      aria-label={expanded ? t('subTabs.hide') : t('subTabs.show')}
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
    >
      {expanded ? (
        <ChevronUp className="size-5" aria-hidden />
      ) : (
        <ChevronDown className="size-5" aria-hidden />
      )}
    </Button>
  )
}

type WarehouseCollapsibleSubTabsPanelProps = {
  expanded: boolean
  visible: boolean
  children: ReactNode
  className?: string
}

export function WarehouseCollapsibleSubTabsPanel({
  expanded,
  visible,
  children,
  className,
}: WarehouseCollapsibleSubTabsPanelProps) {
  if (!visible || !expanded) return null

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-0.5 border-b border-border/70 pb-px',
        className,
      )}
    >
      {children}
    </div>
  )
}
