import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  ArchiveWarehouseBreadcrumb,
  type ArchiveWarehouseBreadcrumbSegment,
} from '@/features/archive-warehouse/components/ArchiveWarehouseBreadcrumb'
import { cn } from '@/lib/utils/cn'

export function ArchiveWarehouseDrillDownHeader({
  segments,
  onBack,
  backAriaLabel,
  trailing,
  className,
}: {
  segments: Array<ArchiveWarehouseBreadcrumbSegment>
  onBack?: () => void
  backAriaLabel?: string
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-end gap-2 border-b border-border pb-2',
        className,
      )}
    >
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-0.5 size-7 shrink-0 text-muted-foreground"
          aria-label={backAriaLabel}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
      ) : null}
      <div className="mb-1.5 min-w-0 flex-1">
        <ArchiveWarehouseBreadcrumb segments={segments} />
      </div>
      {trailing ? <div className="mb-0 shrink-0">{trailing}</div> : null}
    </div>
  )
}
