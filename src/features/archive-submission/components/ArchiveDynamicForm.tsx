import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ArchiveFieldConfigT } from '@/features/archive-config/types'
import { ArchiveReferenceFieldSelect } from '@/features/archive-submission/components/ArchiveReferenceFieldSelect'
import type { ArchiveFieldValueSnapshotT } from '@/features/archive-submission/types'
import { cn } from '@/lib/utils/cn'

interface ArchiveDynamicFormProps {
  fields: Array<ArchiveFieldConfigT>
  value: ArchiveFieldValueSnapshotT
  onChange: (value: ArchiveFieldValueSnapshotT) => void
  disabled?: boolean
}

export function ArchiveDynamicForm({
  fields,
  value,
  onChange,
  disabled = false,
}: ArchiveDynamicFormProps) {
  const { t } = useTranslation('archive-submission')
  const [localValue, setLocalValue] = useState<ArchiveFieldValueSnapshotT>(value)

  const sortedFields = useMemo(() => {
    const isCatalogField = (fieldType: ArchiveFieldConfigT['fieldType']) =>
      fieldType === 'SELECT' || fieldType === 'REFERENCE'

    return [...fields].sort((a, b) => {
      const aCatalog = isCatalogField(a.fieldType)
      const bCatalog = isCatalogField(b.fieldType)
      if (aCatalog !== bCatalog) return aCatalog ? -1 : 1
      return a.displayOrder - b.displayOrder
    })
  }, [fields])

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  function updateField(fieldKey: string, nextValue: unknown) {
    const next = { ...localValue, [fieldKey]: nextValue }
    setLocalValue(next)
    onChange(next)
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {sortedFields.map((field) => {
        const fieldValue = localValue[field.fieldKey]
        const displayLabel =
          field.fieldKey === 'physical_location' ? 'Hộp, cặp' : field.label
        const dependsOnValue =
          field.dependsOnFieldKey && typeof localValue[field.dependsOnFieldKey] === 'string'
            ? String(localValue[field.dependsOnFieldKey])
            : undefined
        const spansFullWidth = field.fieldType === 'TEXTAREA'

        return (
          <div
            key={field.id}
            className={cn('space-y-2', spansFullWidth && 'sm:col-span-2')}
          >
            <Label>
              {displayLabel}
              {field.isRequired ? (
                <span className="text-destructive"> *</span>
              ) : null}
            </Label>

            {field.fieldType === 'TEXT' ? (
              <Input
                value={typeof fieldValue === 'string' ? fieldValue : ''}
                onChange={(event) => updateField(field.fieldKey, event.target.value)}
                disabled={disabled}
              />
            ) : null}

            {field.fieldType === 'TEXTAREA' ? (
              <Textarea
                value={typeof fieldValue === 'string' ? fieldValue : ''}
                onChange={(event) => updateField(field.fieldKey, event.target.value)}
                disabled={disabled}
                rows={3}
              />
            ) : null}

            {field.fieldType === 'NUMBER' ? (
              <Input
                type="number"
                value={
                  typeof fieldValue === 'number' || typeof fieldValue === 'string'
                    ? String(fieldValue)
                    : ''
                }
                onChange={(event) => updateField(field.fieldKey, event.target.value)}
                disabled={disabled}
              />
            ) : null}

            {field.fieldType === 'DATE' ? (
              <Input
                type="date"
                value={typeof fieldValue === 'string' ? fieldValue : ''}
                onChange={(event) => updateField(field.fieldKey, event.target.value)}
                disabled={disabled}
              />
            ) : null}

            {field.fieldType === 'SELECT' ? (
              <Select
                value={typeof fieldValue === 'string' ? fieldValue : ''}
                onValueChange={(next) => updateField(field.fieldKey, next)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {field.fieldType === 'REFERENCE' && field.referenceSource ? (
              <ArchiveReferenceFieldSelect
                referenceSource={field.referenceSource}
                value={typeof fieldValue === 'string' ? fieldValue : ''}
                onValueChange={(next) => updateField(field.fieldKey, next)}
                dependsOnValue={dependsOnValue}
                disabled={disabled}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
