import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildRecordInfoFields } from '@/features/data-management/lib/recordInfo'
import type { DataDossierMetadataT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function RecordMetadataSummaryEntry({
  metadata,
  onOpen,
  className,
}: {
  metadata: DataDossierMetadataT
  onOpen: () => void
  className?: string
}) {
  const { t } = useTranslation('data-management')
  const fields = useMemo(() => buildRecordInfoFields(metadata), [metadata])

  function getFieldLabel(name: string) {
    if (name === 'ho_so_id') return t('recordDetail.hoSoId')
    if (name === 'trang_thai_ho_so') return t('recordDetail.trangThaiHoSo')
    return name
  }

  const previewFields = fields.slice(0, 2)

  return (
    <Card
      variant="bordered"
      className={cn(
        'cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30',
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <CardHeader className="p-0">
            <CardTitle className="text-base">
              {t('recordDetail.summaryTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-0">
            {previewFields.length > 0 ? (
              previewFields.map((field, index) => (
                <div
                  key={`${field.name}-${index}`}
                  className="flex min-w-0 items-baseline gap-2 text-sm"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {getFieldLabel(field.name)}:
                  </span>
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {field.value || '—'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('recordDetail.summaryEmptyHint')}
              </p>
            )}
            {fields.length > previewFields.length ? (
              <p className="text-xs text-muted-foreground">
                {t('recordDetail.summaryMoreFields', {
                  count: fields.length - previewFields.length,
                })}
              </p>
            ) : null}
          </CardContent>
        </div>
        <ChevronRight
          className="mt-1 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </button>
    </Card>
  )
}
