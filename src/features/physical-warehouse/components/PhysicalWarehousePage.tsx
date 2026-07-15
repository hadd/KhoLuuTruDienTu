import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { LayoutGrid, MapPinned, Package, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LocationListPanel } from '@/features/physical-warehouse/components/LocationListPanel'
import { WarehouseConfigPage } from '@/features/physical-warehouse/components/WarehouseConfigPage'
import { WarehouseDiagramTab } from '@/features/physical-warehouse/components/WarehouseDiagramTab'
import { WarehouseManagementTab } from '@/features/physical-warehouse/components/WarehouseManagementTab'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseLevelsQueryOptions,
  physicalWarehouseStatsQueryOptions,
} from '@/features/physical-warehouse/queries'
import {
  WarehouseManagementBackNav,
  warehouseUnderlineTabsListClassName,
  warehouseUnderlineTabsTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'

const routeApi = getRouteApi('/app/physical-warehouse/')

const TAB_VALUES = ['locations', 'config', 'diagram', 'manage'] as const
type WarehouseTab = (typeof TAB_VALUES)[number]

function isWarehouseTab(value: string): value is WarehouseTab {
  return (TAB_VALUES as ReadonlyArray<string>).includes(value)
}

export function PhysicalWarehousePage() {
  const { t } = useTranslation('physical-warehouse')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canManageConfig } = usePhysicalWarehouseAccess()

  const rootId = search.rootId
  const tab = (search.tab ?? 'locations') as WarehouseTab
  const parentId = search.parentId

  const { data: levels = [] } = useQuery(physicalWarehouseLevelsQueryOptions())
  const { data: locations = [] } = useQuery(physicalWarehouseItemsQueryOptions())
  const { data: stats } = useQuery({
    ...physicalWarehouseStatsQueryOptions(rootId ?? ''),
    enabled: Boolean(rootId) && (tab === 'diagram' || tab === 'manage'),
  })

  useEffect(() => {
    if (tab === 'config' && !canManageConfig) {
      void navigate({
        search: (prev) => ({ ...prev, tab: 'locations' }),
        replace: true,
      })
    }
  }, [tab, canManageConfig, navigate])

  useEffect(() => {
    if (
      (tab === 'diagram' || tab === 'manage') &&
      !rootId &&
      locations.length > 0
    ) {
      const firstId = locations[0].id
      void navigate({
        search: (prev) => ({
          ...prev,
          rootId: firstId,
          parentId: firstId,
        }),
        replace: true,
      })
    }
  }, [tab, rootId, locations, navigate])

  function setTab(nextTab: WarehouseTab) {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: nextTab,
        ...(nextTab === 'manage' && rootId
          ? { parentId: prev.parentId ?? rootId }
          : {}),
      }),
    })
  }

  function setLocationFilter(locationId: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        rootId: locationId,
        parentId: locationId,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <WarehouseManagementBackNav
        currentLabel={t('title')}
        description={t('description')}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isWarehouseTab(value)) setTab(value)
        }}
        className="w-full"
      >
        <TabsList className={warehouseUnderlineTabsListClassName}>
          <TabsTrigger
            value="locations"
            className={warehouseUnderlineTabsTriggerClassName}
          >
            <LayoutGrid className="size-4 shrink-0" aria-hidden />
            {t('tabs.locations')}
          </TabsTrigger>
          {canManageConfig ? (
            <TabsTrigger
              value="config"
              className={warehouseUnderlineTabsTriggerClassName}
            >
              <Settings2 className="size-4 shrink-0" aria-hidden />
              {t('tabs.config')}
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="diagram"
            className={warehouseUnderlineTabsTriggerClassName}
          >
            <MapPinned className="size-4 shrink-0" aria-hidden />
            {t('tabs.diagram')}
          </TabsTrigger>
          <TabsTrigger
            value="manage"
            className={warehouseUnderlineTabsTriggerClassName}
          >
            <Package className="size-4 shrink-0" aria-hidden />
            {t('tabs.manage')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-4">
          <LocationListPanel />
        </TabsContent>

        {canManageConfig ? (
          <TabsContent value="config" className="mt-4">
            <WarehouseConfigPage embedded />
          </TabsContent>
        ) : null}

        <TabsContent value="diagram" className="mt-4 space-y-4">
          <LocationFilterBar
            locations={locations}
            rootId={rootId}
            onChange={setLocationFilter}
          />
          {levels.length === 0 ? (
            <Card className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">
                {t('errors.noLevels')}
              </p>
              {canManageConfig ? (
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setTab('config')}
                >
                  {t('actions.config')}
                </button>
              ) : null}
            </Card>
          ) : !rootId ? (
            <Card className="p-6 text-sm text-muted-foreground">
              {locations.length === 0
                ? t('locations.empty')
                : t('filters.selectLocation')}
            </Card>
          ) : (
            <WarehouseDiagramTab
              rootId={rootId}
              levels={levels}
              stats={stats}
            />
          )}
        </TabsContent>

        <TabsContent value="manage" className="mt-4 space-y-4">
          <LocationFilterBar
            locations={locations}
            rootId={rootId}
            onChange={setLocationFilter}
          />
          {levels.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              {t('errors.noLevels')}
            </Card>
          ) : !rootId ? (
            <Card className="p-6 text-sm text-muted-foreground">
              {locations.length === 0
                ? t('locations.empty')
                : t('filters.selectLocation')}
            </Card>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LocationFilterBar({
  locations,
  rootId,
  onChange,
}: {
  locations: Array<{ id: string; name: string }>
  rootId?: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation('physical-warehouse')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[220px] flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          {t('filters.location')}
        </Label>
        <Select
          value={rootId ?? undefined}
          onValueChange={onChange}
          disabled={locations.length === 0}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder={t('filters.selectLocation')} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
