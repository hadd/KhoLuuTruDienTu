import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildRecordInfoFields } from '@/features/data-management/lib/recordInfo'
import type { DataDossierMetadataT } from '@/features/data-management/types'

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
      <span className="min-w-0 truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

export function RecordMetadataSection({
  metadata,
}: {
  metadata: DataDossierMetadataT
}) {
  const { t } = useTranslation('data-management')
  const fields = useMemo(() => buildRecordInfoFields(metadata), [metadata])

  function getFieldLabel(name: string) {
    if (name === 'ho_so_id') return t('recordDetail.hoSoId')
    if (name === 'trang_thai_ho_so') return t('recordDetail.trangThaiHoSo')
    return name
  }

  return (
    <Card variant="bordered">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base">
          {t('recordDetail.summaryTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {fields.length > 0 ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {fields.map((field, index) => (
              <RecordInfoReadOnlyItem
                key={`${field.name}-${index}`}
                label={getFieldLabel(field.name)}
                value={field.value}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
