import type { KeyboardEvent, Ref } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
}) {
  const inputId = `${idPrefix}-${field.name}`
  const canHighlight = Boolean(
    onHighlight && field.bbox.length === 4 && field.page >= 1,
  )

  function handleLabelActivate() {
    if (!canHighlight) return
    onHighlight?.(field)
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
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
      {field.type === 'date' ? (
        <Input
          id={inputId}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      ) : field.type === 'number' ? (
        <Input
          id={inputId}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      ) : field.type === 'string' ? (
        <Input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown ? (event) => onKeyDown(event, index) : undefined}
          disabled={disabled}
          ref={fieldRef as Ref<HTMLInputElement | null>}
        />
      ) : (
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
      )}
    </div>
  )
}
