import type { KeyboardEvent, Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
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
    <div className="flex items-center gap-2">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
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
              'truncate text-sm text-foreground',
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
          <Input
            type="text"
            value={displayValue}
            onChange={(event) => onValueChange(event.target.value)}
            onClick={canActivate ? handleActivate : undefined}
            onKeyDown={
              onKeyDown && index != null
                ? (event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                    }
                    onKeyDown(event, index)
                  }
                : undefined
            }
            placeholder={t('recordDetail.fieldValuePlaceholder')}
            disabled={disabled}
            ref={fieldRef as Ref<HTMLInputElement | null>}
          />
        )}
      </div>
    </div>
  )
}
