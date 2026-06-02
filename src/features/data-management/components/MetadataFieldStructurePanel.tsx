import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import type { DataDocumentFieldT } from '@/features/data-management/types'

type MetadataFieldType = DataDocumentFieldT['type']

const FIELD_TYPES: Array<MetadataFieldType> = [
  'string',
  'date',
  'number',
  'boolean',
]

export function MetadataFieldEditorRow({
  field,
  value,
  index,
  disabled,
  idPrefix,
  onFieldChange,
  onValueChange,
}: {
  field: DataDocumentFieldT
  value: string
  index: number
  disabled: boolean
  idPrefix: string
  onFieldChange: (next: DataDocumentFieldT) => void
  onValueChange: (value: string) => void
}) {
  const { t } = useTranslation('data-management')

  function handleTypeChange(nextType: MetadataFieldType) {
    let nextValue = value
    if (nextType === 'boolean' && value !== 'true' && value !== 'false') {
      nextValue = 'false'
    }
    onFieldChange({ ...field, type: nextType })
    onValueChange(nextValue)
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <Input
          value={field.display}
          onChange={(event) =>
            onFieldChange({ ...field, display: event.target.value })
          }
          placeholder={t('recordDetail.fieldLabelPlaceholder')}
          disabled={disabled}
          className="min-w-[160px] flex-1"
        />
        <Select
          value={field.type}
          onValueChange={(nextType) =>
            handleTypeChange(nextType as MetadataFieldType)
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`recordDetail.fieldTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MetadataFieldInput
        field={field}
        value={value}
        onChange={onValueChange}
        disabled={disabled}
        index={index}
        idPrefix={idPrefix}
        hideLabel
      />
    </div>
  )
}

