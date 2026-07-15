import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { ArchiveWarehouseFondGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseFondGrid'
import { archiveWarehouseFondsQueryOptions } from '@/features/archive-warehouse/queries'

interface ArchiveWarehouseFondsPageProps {
  embedded?: boolean
}

export function ArchiveWarehouseFondsPage({
  embedded = false,
}: ArchiveWarehouseFondsPageProps) {
  const { t } = useTranslation('archive-warehouse')
  const navigate = useNavigate()

  const { data: fondsData, isPending } = useQuery(archiveWarehouseFondsQueryOptions())
  const fonds = fondsData?.items ?? []

  useEffect(() => {
    if (isPending || fonds.length !== 1 || !fonds[0]) return
    void navigate({
      to: '/app/archive-dossiers/$fondId',
      params: { fondId: fonds[0].id },
    })
  }, [fonds, isPending, navigate])

  const sortedFonds = useMemo(
    () => [...fonds].sort((a, b) => a.fondName.localeCompare(b.fondName)),
    [fonds],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">{t('page.fondFilterLabel')}</h2>
        {sortedFonds.length === 0 && !isPending ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {t('page.fondListEmpty')}
          </Card>
        ) : (
          <ArchiveWarehouseFondGrid
            fonds={sortedFonds}
            onSelect={(fondId) => {
              void navigate({
                to: '/app/archive-dossiers/$fondId',
                params: { fondId },
              })
            }}
          />
        )}
      </section>

      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t('page.selectFondFirst')}
      </Card>
    </div>
  )
}
