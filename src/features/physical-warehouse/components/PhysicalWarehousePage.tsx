import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LocationListPanel } from '@/features/physical-warehouse/components/LocationListPanel'
import { WarehouseDiagramTab } from '@/features/physical-warehouse/components/WarehouseDiagramTab'
import { WarehouseManagementTab } from '@/features/physical-warehouse/components/WarehouseManagementTab'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseLevelsQueryOptions,
  physicalWarehouseStatsQueryOptions,
} from '@/features/physical-warehouse/queries'

const routeApi = getRouteApi('/app/physical-warehouse/')

export function PhysicalWarehousePage() {
  const { t } = useTranslation('physical-warehouse')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const navigateTo = useNavigate()
  const { canManageConfig } = usePhysicalWarehouseAccess()

  const rootId = search.rootId
  const tab = search.tab ?? 'diagram'
  const parentId = search.parentId

  const { data: levels = [] } = useQuery(physicalWarehouseLevelsQueryOptions())
  const { data: locations = [] } = useQuery(physicalWarehouseItemsQueryOptions())
  const { data: stats } = useQuery({
    ...physicalWarehouseStatsQueryOptions(rootId ?? ''),
    enabled: Boolean(rootId),
  })

  const selectedLocation = locations.find((l) => l.id === rootId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {canManageConfig ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigateTo({ to: '/app/physical-warehouse/config' })
            }}
          >
            <Settings2 className="mr-1 size-4" />
            {t('actions.config')}
          </Button>
        ) : null}
      </div>

      {levels.length === 0 ? (
        <Card className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">{t('errors.noLevels')}</p>
          {canManageConfig ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void navigateTo({ to: '/app/physical-warehouse/config' })
              }}
            >
              {t('actions.config')}
            </Button>
          ) : null}
        </Card>
      ) : !rootId ? (
        <LocationListPanel
          onSelect={(id) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                rootId: id,
                parentId: id,
                tab: 'diagram',
              }),
            })
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {t('manage.locationLabel')}:{' '}
              </span>
              <span className="font-medium">
                {selectedLocation?.name ?? rootId}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    rootId: undefined,
                    parentId: undefined,
                  }),
                })
              }}
            >
              {t('actions.backToLocations')}
            </Button>
          </div>

          {stats ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.levelStats.map((levelStat) => (
                <Card key={levelStat.levelId} className="p-4">
                  <div className="text-xs text-muted-foreground">
                    {levelStat.levelName}
                  </div>
                  <div className="text-2xl font-semibold">
                    {levelStat.count}
                  </div>
                </Card>
              ))}
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">
                  {t('stats.fillRate')}
                </div>
                <div className="text-2xl font-semibold">
                  {stats.fillRate}%
                </div>
              </Card>
            </div>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={(value) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  tab: value as 'diagram' | 'manage',
                }),
              })
            }}
          >
            <TabsList>
              <TabsTrigger value="diagram">{t('tabs.diagram')}</TabsTrigger>
              <TabsTrigger value="manage">{t('tabs.manage')}</TabsTrigger>
            </TabsList>
            <TabsContent value="diagram" className="mt-4">
              <WarehouseDiagramTab rootId={rootId} levels={levels} />
            </TabsContent>
            <TabsContent value="manage" className="mt-4">
              <WarehouseManagementTab
                rootId={rootId}
                levels={levels}
                selectedParentId={parentId}
                onSelectParent={(id) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      parentId: id,
                      tab: 'manage',
                    }),
                  })
                }}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
