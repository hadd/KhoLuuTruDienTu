import { useTranslation } from 'react-i18next'

import { formatFileSize } from '@/lib/utils/format'

export type ArchiveWarehouseStatSummaryT = {
  dossierCount?: number
  documentCount: number
  totalSizeKb: number
}

export function ArchiveWarehouseStatCards({
  summary,
}: {
  summary: ArchiveWarehouseStatSummaryT
}) {
  const { t } = useTranslation('archive-warehouse')

  const items = [
    ...(summary.dossierCount != null
      ? [
          {
            label: t('stats.dossierCount'),
            value: summary.dossierCount.toLocaleString(),
          },
        ]
      : []),
    {
      label: t('stats.documentCount'),
      value: summary.documentCount.toLocaleString(),
    },
    {
      label: t('stats.storageSize'),
      value: formatFileSize(summary.totalSizeKb * 1024),
    },
  ]

  return (
    <p className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <span key={item.label}>
          {item.label}:{' '}
          <span className="font-medium text-foreground">{item.value}</span>
        </span>
      ))}
    </p>
  )
}
