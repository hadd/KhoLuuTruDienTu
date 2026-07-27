import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveWarehouseFondListItemT } from '@/features/archive-warehouse/types'
import { ArchiveWarehouseCatalogGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseCatalogGrid'

type ArchiveWarehouseFondGridProps = {
  fonds: Array<ArchiveWarehouseFondListItemT>
  selectedFondId?: string
  onSelect: (fondId: string) => void
  formatDossierCount: (count: number) => string
}

export function ArchiveWarehouseFondGrid({
  fonds,
  selectedFondId,
  onSelect,
  formatDossierCount,
}: ArchiveWarehouseFondGridProps) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <ArchiveWarehouseCatalogGrid
      items={fonds.map((fond) => ({
        id: fond.id,
        name: fond.fondName,
        description: formatDossierCount(fond.warehouseDossierCount ?? 0),
      }))}
      selectedId={selectedFondId}
      emptyMessage={t('page.fondListEmpty')}
      icon={Archive}
      onSelect={onSelect}
    />
  )
}
