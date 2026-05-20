import { Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DataDocumentFieldT } from '@/features/data-management/types'

export function DocumentMetadataForm({
  fields,
}: {
  fields: DataDocumentFieldT[]
}) {
  const { t } = useTranslation('data-management')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const f of fields) {
      map[f.name] = f.value
    }
    return map
  })

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSave() {
    // TODO: send to backend when API is ready
    toast.success(t('metadata.saveSuccess'))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label
                htmlFor={`field-${field.name}`}
                className="text-sm font-medium"
              >
                {field.display}
              </Label>
              {field.type === 'date' ? (
                <Input
                  id={`field-${field.name}`}
                  type="date"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              ) : field.type === 'number' ? (
                <Input
                  id={`field-${field.name}`}
                  type="number"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              ) : (
                <Input
                  id={`field-${field.name}`}
                  type="text"
                  value={values[field.name] ?? ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
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
        >
          <Save className="size-4" aria-hidden />
          {t('metadata.save')}
        </Button>
      </div>
    </div>
  )
}
