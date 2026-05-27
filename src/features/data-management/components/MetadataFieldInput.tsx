import type { KeyboardEvent, ReactNode, Ref } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
}) {
  const inputId = `${idPrefix}-${field.name}`
  const canHighlight = Boolean(
    onHighlight && field.bbox.length === 4 && field.page >= 1,
  )

  function handleLabelActivate() {
    if (!canHighlight) return
    onHighlight?.(field)
  }

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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      )
    }

    if (field.type === 'string') {
      return (
        <Input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      )
    }

    return (
      <Textarea
        id={inputId}
        rows={textareaRows}
        className={textareaClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={
          onKeyDown ? (event) => onKeyDown(event, index, true) : undefined
        }
        disabled={disabled}
        ref={fieldRef as Ref<HTMLTextAreaElement | null>}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid gap-2',
        !hideLabel && 'sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center',
      )}
    >
      {!hideLabel ? (
        <Label
          htmlFor={inputId}
          className={cn(
            'text-sm font-medium text-muted-foreground',
            canHighlight &&
              'cursor-pointer rounded-sm hover:text-foreground hover:underline underline-offset-2',
            isHighlighted && 'font-semibold text-primary',
          )}
          onClick={handleLabelActivate}
          onKeyDown={(event) => {
            if (!canHighlight) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleLabelActivate()
            }
          }}
          tabIndex={canHighlight ? 0 : undefined}
          role={canHighlight ? 'button' : undefined}
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
  )
}
