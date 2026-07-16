import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildRecordInfoFields } from '@/features/data-management/lib/recordInfo'
import type {
  DataDossierMetadataT,
  DataRecordInfoFieldT,
} from '@/features/data-management/types'

const RESERVED_ROOT_FIELD_NAMES = new Set([
  'ho_so_id',
  'trang_thai_ho_so',
  'metadata_groups',
  'general_fields',
  'thong_tin_chung',
])

function RecordInfoReadOnlyItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 truncate font-medium text-foreground">
        {value || '—'}
      </span>
    </div>
  )
}

export function RecordMetadataEditSection({
  metadata,
  readOnly = false,
  duplicateFieldNames = new Set<string>(),
  onHoSoIdChange,
  onTrangThaiHoSoChange,
  onGeneralFieldChange,
  onAddGeneralField,
  onRemoveGeneralField,
}: {
  metadata: DataDossierMetadataT
  readOnly?: boolean
  duplicateFieldNames?: ReadonlySet<string>
  onHoSoIdChange?: (value: string) => void
  onTrangThaiHoSoChange?: (value: string) => void
  onGeneralFieldChange?: (
    index: number,
    patch: Partial<DataRecordInfoFieldT>,
  ) => void
  onAddGeneralField?: () => void
  onRemoveGeneralField?: (index: number) => void
}) {
  const { t } = useTranslation('data-management')
  const generalFields = metadata.general_fields ?? []

  const readOnlyFields = useMemo(
    () => buildRecordInfoFields(metadata),
    [metadata],
  )

  function getFieldLabel(name: string) {
    if (name === 'ho_so_id') return t('recordDetail.hoSoId')
    if (name === 'trang_thai_ho_so') return t('recordDetail.trangThaiHoSo')
    return name
  }

  if (readOnly) {
    return (
      <div className="space-y-4">
        {readOnlyFields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {readOnlyFields.map((field, index) => (
              <RecordInfoReadOnlyItem
                key={`${field.name}-${index}`}
                label={getFieldLabel(field.name)}
                value={field.value}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('recordDetail.summaryEmptyHint')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="record-summary-ho-so-id">
            {t('recordDetail.hoSoId')}
          </Label>
          <Input
            id="record-summary-ho-so-id"
            value={metadata.ho_so_id ?? ''}
            onChange={(event) => onHoSoIdChange?.(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="record-summary-trang-thai-ho-so">
            {t('recordDetail.trangThaiHoSo')}
          </Label>
          <Input
            id="record-summary-trang-thai-ho-so"
            value={metadata.trang_thai_ho_so ?? ''}
            onChange={(event) => onTrangThaiHoSoChange?.(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground">
            {t('recordDetail.customFieldsTitle')}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onAddGeneralField}
          >
            <Plus className="size-4" aria-hidden />
            {t('recordDetail.addField')}
          </Button>
        </div>

        {generalFields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('recordDetail.noCustomFields')}
          </p>
        ) : (
          <div className="space-y-3">
            {generalFields.map((field, index) => {
              const trimmedName = field.name.trim()
              const isDuplicate = duplicateFieldNames.has(trimmedName)
              const isReserved =
                trimmedName !== '' &&
                RESERVED_ROOT_FIELD_NAMES.has(trimmedName)

              return (
                <div
                  key={`general-field-${index}`}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`record-summary-field-name-${index}`}>
                      {t('recordDetail.fieldName')}
                    </Label>
                    <Input
                      id={`record-summary-field-name-${index}`}
                      value={field.name}
                      onChange={(event) =>
                        onGeneralFieldChange?.(index, {
                          name: event.target.value,
                        })
                      }
                      aria-invalid={isDuplicate || isReserved}
                    />
                    {isDuplicate ? (
                      <p className="text-xs text-destructive">
                        {t('recordDetail.duplicateFieldName')}
                      </p>
                    ) : null}
                    {isReserved ? (
                      <p className="text-xs text-destructive">
                        {t('recordDetail.reservedFieldName')}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`record-summary-field-value-${index}`}>
                      {t('recordDetail.fieldValue')}
                    </Label>
                    <Input
                      id={`record-summary-field-value-${index}`}
                      value={field.value}
                      onChange={(event) =>
                        onGeneralFieldChange?.(index, {
                          value: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onRemoveGeneralField?.(index)}
                      aria-label={t('recordDetail.removeField')}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function collectDuplicateSummaryFieldNames(
  metadata: DataDossierMetadataT,
): Set<string> {
  const counts = new Map<string, number>()
  const reserved = new Set<string>()

  if ((metadata.ho_so_id ?? '').trim()) {
    counts.set('ho_so_id', 1)
  }
  if ((metadata.trang_thai_ho_so ?? '').trim()) {
    counts.set('trang_thai_ho_so', 1)
  }

  for (const field of metadata.general_fields ?? []) {
    const name = field.name.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
    if (RESERVED_ROOT_FIELD_NAMES.has(name)) {
      reserved.add(name)
    }
  }

  const duplicates = new Set<string>(reserved)
  for (const [name, count] of counts) {
    if (count > 1) duplicates.add(name)
  }
  return duplicates
}
