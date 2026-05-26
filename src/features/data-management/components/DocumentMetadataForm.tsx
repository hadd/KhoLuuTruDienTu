import { Save } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { buildMetadataFieldValues } from '@/features/data-management/lib/metadataDate'
import type { DataDocumentFieldT } from '@/features/data-management/types'

export function DocumentMetadataForm({
  fields,
  role,
  onAdvance,
  onFieldHighlight,
  highlightedFieldName,
}: {
  fields: Array<DataDocumentFieldT>
  role: string
  onAdvance?: () => void
  onFieldHighlight?: (field: DataDocumentFieldT) => void
  highlightedFieldName?: string | null
}) {
  const { t } = useTranslation('data-management')
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildMetadataFieldValues(fields),
  )
  const fieldRefs = useRef<Array<HTMLElement | null>>([])
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSave() {
    toast.success(t('metadata.saveSuccess'))
    onAdvance?.()
  }

  function focusField(index: number) {
    const target = fieldRefs.current[index] as HTMLTextAreaElement | HTMLInputElement
    if (!target) return
    target.focus()
    try {
      if (target.type === 'text' || target.type === 'textarea') {
        const end = target.value.length
        target.setSelectionRange(end, end)
      }
    } catch {
      // ignore
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    index: number,
    isTextArea: boolean = false,
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (index >= fields.length - 1) {
        saveButtonRef.current?.focus()
      } else {
        focusField(index + 1)
      }
      return
    }
    if (isTextArea) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusField(Math.min(index + 1, fields.length - 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusField(Math.max(index - 1, 0))
        return
      }
    }
  }

  return (
    <div className="flex min-h-[360px] flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-3">
          {fields.map((field, index) => (
            <MetadataFieldInput
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={(value) => handleChange(field.name, value)}
              onHighlight={onFieldHighlight}
              isHighlighted={highlightedFieldName === field.name}
              index={index}
              idPrefix="field"
              onKeyDown={handleKeyDown}
              fieldRef={(element) => {
                fieldRefs.current[index] = element
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 justify-end pt-2">
        <Button
          type="button"
          variant="default"
          className="gap-2"
          onClick={handleSave}
          ref={saveButtonRef}
        >
          <Save className="size-4" aria-hidden />
          {role === 'qc' ? t('metadata.approve') : t('metadata.save')}
        </Button>
      </div>
    </div>
  )
}
