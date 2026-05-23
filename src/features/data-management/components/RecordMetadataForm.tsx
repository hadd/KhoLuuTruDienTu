import { Save } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DataDocumentFieldT } from '@/features/data-management/types'

export function RecordMetadataForm({
  fields,
  role,
  onAdvance,
}: {
  fields: Array<DataDocumentFieldT>
  role: string
  onAdvance?: () => void
}) {
  const { t } = useTranslation('data-management')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const f of fields) {
      map[f.name] = f.value
    }
    return map
  })
  const isReadOnly = role === 'editor'
  const fieldRefs = useRef<Array<HTMLElement | null>>([])
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSave() {
    if (isReadOnly) return
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
    } catch (e) {
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4">
          {fields.map((field, index) => (
            <div
              key={field.name}
              className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start"
            >
              <Label
                htmlFor={`record-field-${field.name}`}
                className="text-sm font-medium text-muted-foreground"
              >
                {field.display}
              </Label>
              {field.type === 'date' ? (
                <Input
                  id={`record-field-${field.name}`}
                  type="date"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, index)}
                  disabled={isReadOnly}
                  ref={(el) => { fieldRefs.current[index] = el as any }}
                />
              ) : field.type === 'number' ? (
                <Input
                  id={`record-field-${field.name}`}
                  type="number"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, index)}
                  disabled={isReadOnly}
                  ref={(el) => { fieldRefs.current[index] = el as any }}
                />
              ) : field.type === 'string' ? (
                <Input
                  id={`record-field-${field.name}`}
                  type="text"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, index)}
                  disabled={isReadOnly}
                  ref={(el) => { fieldRefs.current[index] = el as any }}
                />
              ) : (
                <Textarea
                  id={`record-field-${field.name}`}
                  rows={3}
                  className="min-h-24 resize-y"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  onKeyDown={
                    isReadOnly ? undefined : (e) => handleKeyDown(e, index, true)
                  }
                  disabled={isReadOnly}
                  ref={(el) => { fieldRefs.current[index] = el }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex shrink-0 justify-end pt-2">
        <Button
          type="button"
          variant="default"
          className="gap-2"
          onClick={handleSave}
          disabled={isReadOnly}
          ref={saveButtonRef}
        >
          <Save className="size-4" aria-hidden />
          {role === 'qc' ? 'Duyệt' : 'Lưu'}
        </Button>
      </div>
    </div>
  )
}
