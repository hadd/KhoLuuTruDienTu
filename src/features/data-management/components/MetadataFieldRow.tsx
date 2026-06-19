import type { KeyboardEvent, Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MetadataFieldRejectMark } from '@/features/data-management/components/MetadataFieldRejectMark'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import type { DataDocumentFieldT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function MetadataFieldRow({
  field,
  value,
  disabled,
  editDisplay,
  onFieldChange,
  onValueChange,
  onHighlight,
  isHighlighted = false,
  index,
  onKeyDown,
  fieldRef,
  rejectMark,
  isQcRejectedHighlight = false,
}: {
  field: DataDocumentFieldT
  value: unknown
  disabled: boolean
  editDisplay: boolean
  onFieldChange?: (next: DataDocumentFieldT) => void
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
  const { t } = useTranslation('data-management')
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
        {editDisplay ? (
          <Input
            value={field.display}
            onChange={(event) =>
              onFieldChange?.({ ...field, display: event.target.value })
            }
            placeholder={t('recordDetail.fieldLabelPlaceholder')}
            disabled={disabled}
          />
        ) : (
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
            aria-label={
              canActivate ? t('recordDetail.viewFieldInPdf') : undefined
            }
          >
            {field.display}
          </p>
        )}
        {disabled ? (
          <p
            className={cn(
              'whitespace-pre-wrap break-words text-sm text-foreground',
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
            aria-label={
              canActivate ? t('recordDetail.viewFieldInPdf') : undefined
            }
          >
            {displayValue.trim() || '—'}
          </p>
        ) : (
          <Textarea
            rows={1}
            className="min-h-9"
            value={displayValue}
            onChange={(event) => {
              onValueChange(event.target.value)
            }}
            onClick={canActivate ? handleActivate : undefined}
            onFocus={canActivate ? handleActivate : undefined}
            onKeyDown={
              onKeyDown && index != null
                ? (event) => {
                    onKeyDown(event, index, true)
                  }
                : undefined
            }
            placeholder={t('recordDetail.fieldValuePlaceholder')}
            disabled={disabled}
            ref={fieldRef as Ref<HTMLTextAreaElement | null>}
          />
        )}
      </div>
    </div>
  )
}
