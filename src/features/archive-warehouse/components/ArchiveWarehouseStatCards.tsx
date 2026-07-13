import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import type { ArchiveWarehouseFondSummaryT } from '@/features/archive-warehouse/types'
import { formatFileSize } from '@/lib/utils/format'

export function ArchiveWarehouseStatCards({
  summary,
}: {
  summary: ArchiveWarehouseFondSummaryT
}) {
  const { t } = useTranslation('archive-warehouse')

  const cards = [
    {
      label: t('stats.dossierCount'),
      value: summary.dossierCount.toLocaleString(),
    },
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
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
        </Card>
      ))}
    </div>
  )
}
