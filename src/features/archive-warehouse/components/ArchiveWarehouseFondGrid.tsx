import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveFondT } from '@/features/archive-fond/types'
import { ArchiveWarehouseCatalogGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseCatalogGrid'

type ArchiveWarehouseFondGridProps = {
  fonds: Array<ArchiveFondT>
  selectedFondId?: string
  onSelect: (fondId: string) => void
}

export function ArchiveWarehouseFondGrid({
  fonds,
  selectedFondId,
  onSelect,
}: ArchiveWarehouseFondGridProps) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <ArchiveWarehouseCatalogGrid
      items={fonds.map((fond) => ({ id: fond.id, name: fond.fondName }))}
      selectedId={selectedFondId}
      emptyMessage={t('page.fondListEmpty')}
      icon={Archive}
      onSelect={onSelect}
    />
  )
}
