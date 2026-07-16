import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, MapPinned, Package } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPhysicalWarehouseItem } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { LocationListPanel } from '@/features/physical-warehouse/components/LocationListPanel'
import { WarehouseDiagramTab } from '@/features/physical-warehouse/components/WarehouseDiagramTab'
import { WarehouseManagementTab } from '@/features/physical-warehouse/components/WarehouseManagementTab'
import {
  physicalWarehouseQueryKeyPrefix,
  physicalWarehouseStatsQueryOptions,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { WarehouseSectionTabs } from '@/features/warehouse-management/components/WarehouseSectionTabs'
import { warehouseUnderlineTabsTriggerCompactClassName } from '@/features/warehouse-management/components/WarehouseManagementBackNav'

const routeApi = getRouteApi('/app/physical-warehouse/')

const WAREHOUSE_DETAIL_TABS = ['diagram', 'manage'] as const
type WarehouseDetailTab = (typeof WAREHOUSE_DETAIL_TABS)[number]

function isWarehouseDetailTab(value: string): value is WarehouseDetailTab {
  return (WAREHOUSE_DETAIL_TABS as ReadonlyArray<string>).includes(value)
}

export function PhysicalWarehousePage() {
  const { t } = useTranslation('physical-warehouse')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const rootId = search.rootId
  const warehouseId = search.warehouseId
  const rawTab = search.tab
  const parentId = search.parentId

  const warehouseSelected = Boolean(rootId && warehouseId)
  const detailTab: WarehouseDetailTab =
    rawTab === 'manage' ? 'manage' : 'diagram'
  const manageParentId = parentId ?? warehouseId

  const { data: stats } = useQuery({
    ...physicalWarehouseStatsQueryOptions(rootId ?? ''),
    enabled: warehouseSelected,
  })

  const {
    canManageWarehouses,
    canViewPhysicalWarehouse,
    isAccessReady,
  } = usePhysicalWarehouseAccess()
  const canUseManageTab =
    canManageWarehouses || canViewPhysicalWarehouse

  const { data: selectedLocation } = useQuery({
    queryKey: [...physicalWarehouseQueryKeyPrefix, 'item', rootId] as const,
    queryFn: () => getPhysicalWarehouseItem(rootId!),
    enabled: warehouseSelected && Boolean(rootId),
    staleTime: 15_000,
  })

  const { data: selectedWarehouse } = useQuery({
    queryKey: [...physicalWarehouseQueryKeyPrefix, 'item', warehouseId] as const,
    queryFn: () => getPhysicalWarehouseItem(warehouseId!),
    enabled: warehouseSelected,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (
      warehouseSelected &&
      isAccessReady &&
      detailTab === 'manage' &&
      !canUseManageTab
    ) {
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: undefined,
        }),
        replace: true,
      })
    }
  }, [
    warehouseSelected,
    isAccessReady,
    detailTab,
    canUseManageTab,
    navigate,
  ])

  function setDetailTab(nextTab: WarehouseDetailTab) {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: nextTab,
      }),
    })
  }

  function navigateToLocationItem(item: PhysicalWarehouseItemT) {
    if (item.parentId == null) {
      void navigate({
        search: (prev) => ({
          ...prev,
          rootId: item.id,
          parentId: item.id,
          warehouseId: undefined,
          tab: undefined,
        }),
      })
      return
    }

    if (!rootId) return

    void navigate({
      search: (prev) => ({
        ...prev,
        tab: 'diagram',
        rootId: prev.rootId,
        warehouseId: item.id,
        parentId: item.id,
      }),
    })
  }

  function navigateBackFromLocationDrillDown() {
    void navigate({
      search: (prev) => ({
        ...prev,
        rootId: undefined,
        parentId: undefined,
        warehouseId: undefined,
        tab: undefined,
      }),
    })
  }

  function navigateBackFromWarehouse() {
    void navigate({
      search: (prev) => ({
        ...prev,
        warehouseId: undefined,
        parentId: undefined,
        tab: undefined,
      }),
    })
  }

  const locationsViewParentId =
    !warehouseSelected && rootId ? rootId : undefined

  return (
    <div className="space-y-2">
      <WarehouseSectionTabs active="physical" compact />

      {warehouseSelected ? (
        <Tabs
          value={detailTab}
          onValueChange={(value) => {
            if (isWarehouseDetailTab(value)) setDetailTab(value)
          }}
          className="w-full gap-0"
        >
          <div className="flex items-end gap-2 border-b border-border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-0.5 size-7 shrink-0 text-muted-foreground"
              aria-label={t('actions.backToWarehouses')}
              onClick={navigateBackFromWarehouse}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <p className="mb-1.5 min-w-0 max-w-[min(100%,20rem)] shrink truncate text-sm font-semibold">
              {selectedLocation?.name && selectedWarehouse?.name
                ? t('detail.locationWarehouseTitle', {
                    location: selectedLocation.name,
                    warehouse: selectedWarehouse.name,
                  })
                : (selectedWarehouse?.name ?? selectedLocation?.name ?? '...')}
            </p>
            <TabsList className="mb-0 h-auto shrink-0 border-0 bg-transparent p-0">
              <TabsTrigger
                value="diagram"
                className={warehouseUnderlineTabsTriggerCompactClassName}
              >
                <MapPinned className="size-3.5 shrink-0" aria-hidden />
                {t('tabs.diagram')}
              </TabsTrigger>
              {canUseManageTab ? (
                <TabsTrigger
                  value="manage"
                  className={warehouseUnderlineTabsTriggerCompactClassName}
                >
                  <Package className="size-3.5 shrink-0" aria-hidden />
                  {t('tabs.manage')}
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>

          <TabsContent value="diagram" className="mt-2">
            <WarehouseDiagramTab rootId={rootId!} stats={stats} compact />
          </TabsContent>

          {canUseManageTab ? (
            <TabsContent value="manage" className="mt-2">
              <WarehouseManagementTab
                rootId={rootId!}
                selectedParentId={manageParentId}
                onSelectParent={(id) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      parentId: id,
                      tab: 'manage',
                      warehouseId: prev.warehouseId,
                    }),
                  })
                }}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : (
        <LocationListPanel
          parentId={locationsViewParentId}
          onNavigateToItem={navigateToLocationItem}
          onNavigateBack={navigateBackFromLocationDrillDown}
        />
      )}
    </div>
  )
}
