import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MetadataFieldRejectMark } from '@/features/data-management/components/MetadataFieldRejectMark'
import type { DataDocumentFieldT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function MetadataFieldInput({
  field,
  value,
  onChange,
  onHighlight,
  isHighlighted = false,
  disabled = false,
  index,
  idPrefix,
  onKeyDown,
  fieldRef,
  textareaRows = 1,
  textareaClassName,
  hideLabel = false,
  trailingAction,
  rejectMark,
  isQcRejectedHighlight = false,
}: {
  field: DataDocumentFieldT
  value: string
  onChange: (value: string) => void
  onHighlight?: (field: DataDocumentFieldT) => void
  isHighlighted?: boolean
  disabled?: boolean
  index: number
  idPrefix: string
  onKeyDown?: (
    event: KeyboardEvent<HTMLElement>,
    index: number,
    isTextArea?: boolean,
  ) => void
  fieldRef?: Ref<HTMLElement | null>
  textareaRows?: number
  textareaClassName?: string
  hideLabel?: boolean
  trailingAction?: ReactNode
  rejectMark?: {
    id: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
  }
  isQcRejectedHighlight?: boolean
}) {
  const { t } = useTranslation('data-management')
  const inputId = `${idPrefix}-${field.name}`
  const canActivate = Boolean(onHighlight)
  const emptyPlaceholder = value.trim()
    ? undefined
    : t('recordDetail.emptyFieldPlaceholder')

  function handleActivate() {
    if (!canActivate) return
    onHighlight?.(field)
  }

  const activateClass = canActivate
    ? 'cursor-pointer hover:text-foreground hover:underline underline-offset-2'
    : ''

  function renderControl() {
    if (field.type === 'boolean') {
      return (
        <Switch
          id={inputId}
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          disabled={disabled}
        />
      )
    }

    if (field.type === 'date') {
      return (
        <Input
          id={inputId}
          type="date"
          value={value}
          placeholder={emptyPlaceholder}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onClick={canActivate ? handleActivate : undefined}
          onFocus={canActivate ? handleActivate : undefined}
          onKeyDown={
            onKeyDown
              ? (event) => {
                  onKeyDown(event, index)
                }
              : undefined
          }
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      )
    }

    if (field.type === 'number') {
      return (
        <Input
          id={inputId}
          type="number"
          value={value}
          placeholder={emptyPlaceholder}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onClick={canActivate ? handleActivate : undefined}
          onFocus={canActivate ? handleActivate : undefined}
          onKeyDown={
            onKeyDown
              ? (event) => {
                  onKeyDown(event, index)
                }
              : undefined
          }
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      )
    }

    if (field.type === 'string') {
      return (
        <Textarea
          id={inputId}
          rows={1}
          className="min-h-9"
          value={value}
          placeholder={emptyPlaceholder}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onClick={canActivate ? handleActivate : undefined}
          onFocus={canActivate ? handleActivate : undefined}
          onKeyDown={
            onKeyDown
              ? (event) => {
                  onKeyDown(event, index, true)
                }
              : undefined
          }
          disabled={disabled}
          ref={fieldRef as Ref<HTMLTextAreaElement | null>}
        />
      )
    }

    return (
      <Textarea
        id={inputId}
        rows={textareaRows}
        className={textareaClassName}
        value={value}
        placeholder={emptyPlaceholder}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onClick={canActivate ? handleActivate : undefined}
        onFocus={canActivate ? handleActivate : undefined}
        onKeyDown={
          onKeyDown
            ? (event) => {
                onKeyDown(event, index, true)
              }
            : undefined
        }
        disabled={disabled}
        ref={fieldRef as Ref<HTMLTextAreaElement | null>}
      />
    )
  }

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
      <div
        className={cn(
          'grid min-w-0 flex-1 gap-2',
          !hideLabel && 'sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start',
        )}
      >
        {!hideLabel ? (
          <Label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-muted-foreground',
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
          </Label>
        ) : null}
        {trailingAction ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">{renderControl()}</div>
            {trailingAction}
          </div>
        ) : (
          renderControl()
        )}
      </div>
    </div>
  )
}
