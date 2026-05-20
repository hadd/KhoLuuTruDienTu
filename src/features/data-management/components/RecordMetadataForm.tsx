import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DataDocumentFieldT } from '@/features/data-management/types'

export function RecordMetadataForm({
  fields,
}: {
  fields: DataDocumentFieldT[]
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label
                htmlFor={`record-field-${field.name}`}
                className="text-sm font-medium"
              >
                {field.display}
              </Label>
              <Input
                id={`record-field-${field.name}`}
                type={
                  field.type === 'date'
                    ? 'date'
                    : field.type === 'number'
                      ? 'number'
                      : 'text'
                }
                value={field.value}
                readOnly
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
