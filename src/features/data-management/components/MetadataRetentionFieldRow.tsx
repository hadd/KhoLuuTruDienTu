import type { KeyboardEvent, Ref } from 'react'

import { MetadataRetentionFieldSelect } from '@/features/data-management/components/MetadataRetentionFieldSelect'
import { MetadataFieldRejectMark } from '@/features/data-management/components/MetadataFieldRejectMark'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import type { DataDocumentFieldT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function MetadataRetentionFieldRow({
  field,
  value,
  disabled,
  onValueChange,
  onHighlight,
  isHighlighted = false,
  rejectMark,
  isQcRejectedHighlight = false,
}: {
  field: DataDocumentFieldT
  value: unknown
  disabled: boolean
  onValueChange: (value: string) => void
  onHighlight?: (field: DataDocumentFieldT) => void
  isHighlighted?: boolean
  index?: number
  onKeyDown?: (
    event: KeyboardEvent<HTMLElement>,
    index: number,
    isTextArea?: boolean,
  ) => void
  fieldRef?: Ref<HTMLElement | null>
  rejectMark?: {
    id: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
  }
  isQcRejectedHighlight?: boolean
}) {
  const displayValue = coerceMetadataText(value)
  const canActivate = Boolean(onHighlight)

  function handleActivate() {
    if (!canActivate) return
    onHighlight?.(field)
  }

  const activateClass = canActivate
    ? 'cursor-pointer hover:text-foreground hover:underline underline-offset-2'
    : ''

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md transition-colors',
        (rejectMark?.checked || isQcRejectedHighlight) &&
          'border border-destructive/40 bg-destructive/5 p-2',
      )}
    >
      {rejectMark ? (
        <MetadataFieldRejectMark
          id={rejectMark.id}
          fieldLabel={field.display}
          checked={rejectMark.checked}
          onCheckedChange={rejectMark.onCheckedChange}
          disabled={rejectMark.disabled}
        />
      ) : null}
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
        <p
          className={cn(
            'truncate text-sm font-medium text-muted-foreground',
            activateClass,
            isHighlighted && 'font-semibold text-primary',
          )}
          onClick={handleActivate}
          onKeyDown={(event) => {
            if (!canActivate) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleActivate()
            }
          }}
          tabIndex={canActivate ? 0 : undefined}
          role={canActivate ? 'button' : undefined}
        >
          {field.display}
        </p>
        <MetadataRetentionFieldSelect
          value={displayValue}
          onValueChange={onValueChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
