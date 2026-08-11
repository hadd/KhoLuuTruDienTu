import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, MapPin, MapPinned, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { getPhysicalWarehouseItem } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { PhysicalWarehouseArchiveSearchPanel } from '@/features/physical-warehouse/components/PhysicalWarehouseArchiveSearchPanel'
import { LocationListPanel } from '@/features/physical-warehouse/components/LocationListPanel'
import { WarehouseDiagramTab } from '@/features/physical-warehouse/components/WarehouseDiagramTab'
import { WarehouseManagementTab } from '@/features/physical-warehouse/components/WarehouseManagementTab'
import {
  physicalWarehouseQueryKeyPrefix,
  physicalWarehouseStatsQueryOptions,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import type { PhysicalWarehouseSearchT } from '@/features/physical-warehouse/schemas'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { WarehousePageShell } from '@/features/warehouse-management/components/WarehousePageShell'
import {
  warehouseUnderlineSubTabsListClassName,
  warehouseUnderlineSubTabsTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

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
  const focusDossierId = search.focusDossierId
  const highlightPhysicalItemId = search.highlightPhysicalItemId
  const focusDossierTitle = search.focusDossierTitle
  const focusPlacementPath = search.focusPlacementPath

  const [hideSearchResults, setHideSearchResults] = useState(false)

  useEffect(() => {
    if (!warehouseSelected) {
      setHideSearchResults(false)
    }
  }, [warehouseSelected])

  const suppressSearchResults =
    warehouseSelected && detailTab === 'diagram' && hideSearchResults

  function handleNavigateToPlacement(patch: Partial<PhysicalWarehouseSearchT>) {
    setHideSearchResults(true)
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
    })
  }

  function clearFocusDossier() {
    void navigate({
      search: (prev) => ({
        ...prev,
        focusDossierId: undefined,
        highlightPhysicalItemId: undefined,
        focusDossierTitle: undefined,
        focusPlacementPath: undefined,
      }),
      replace: true,
    })
  }

  useEffect(() => {
    if (!highlightPhysicalItemId) return
    const timer = window.setTimeout(() => {
      void navigate({
        search: (prev) => ({
          ...prev,
          highlightPhysicalItemId: undefined,
        }),
        replace: true,
      })
    }, 12_000)
    return () => window.clearTimeout(timer)
  }, [highlightPhysicalItemId, navigate])

  const { data: stats } = useQuery({
    ...physicalWarehouseStatsQueryOptions(warehouseId ?? rootId ?? ''),
    enabled: warehouseSelected && Boolean(warehouseId ?? rootId),
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
        focusDossierId: undefined,
        highlightPhysicalItemId: undefined,
        focusDossierTitle: undefined,
        focusPlacementPath: undefined,
      }),
    })
  }

  const locationsViewParentId =
    !warehouseSelected && rootId ? rootId : undefined

  const physicalSubTabs = warehouseSelected ? (
    <nav
      className={warehouseUnderlineSubTabsListClassName}
      aria-label={t('tabs.ariaLabel')}
    >
      <button
        type="button"
        className={cn(
          warehouseUnderlineSubTabsTriggerClassName,
          'inline-flex items-center',
        )}
        data-state={detailTab === 'diagram' ? 'active' : 'inactive'}
        aria-current={detailTab === 'diagram' ? 'page' : undefined}
        onClick={() => setDetailTab('diagram')}
      >
        <MapPinned className="size-3.5 shrink-0" aria-hidden />
        {t('tabs.diagram')}
      </button>
      {canUseManageTab ? (
        <button
          type="button"
          className={cn(
            warehouseUnderlineSubTabsTriggerClassName,
            'inline-flex items-center',
          )}
          data-state={detailTab === 'manage' ? 'active' : 'inactive'}
          aria-current={detailTab === 'manage' ? 'page' : undefined}
          onClick={() => setDetailTab('manage')}
        >
          <Package className="size-3.5 shrink-0" aria-hidden />
          {t('tabs.manage')}
        </button>
      ) : null}
    </nav>
  ) : null

  return (
    <WarehousePageShell
      section="physical"
      hasSubTabs={warehouseSelected}
      subTabs={physicalSubTabs}
    >
      <PhysicalWarehouseArchiveSearchPanel
        onNavigateToPlacement={handleNavigateToPlacement}
        hideSearchResults={suppressSearchResults}
        onRevealSearchResults={() => setHideSearchResults(false)}
      />

      {warehouseSelected ? (
        <Tabs
          value={detailTab}
          onValueChange={(value) => {
            if (isWarehouseDetailTab(value)) setDetailTab(value)
          }}
          className="flex min-h-0 w-full flex-1 flex-col gap-0"
        >
          <div className="flex shrink-0 items-end gap-2 border-b border-border">
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
          </div>

          <TabsContent
            value="diagram"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {focusDossierTitle || focusPlacementPath ? (
              <div
                className="mb-2 shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5"
                role="status"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('search.diagramFocusHeading')}
                </p>
                {focusDossierTitle ? (
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {focusDossierTitle}
                  </p>
                ) : null}
                {focusPlacementPath ? (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{focusPlacementPath}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            <WarehouseDiagramTab
              rootId={rootId!}
              warehouseId={warehouseId}
              stats={stats}
              compact
              highlightPhysicalItemId={highlightPhysicalItemId}
            />
          </TabsContent>

          {canUseManageTab ? (
            <TabsContent
              value="manage"
              className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <WarehouseManagementTab
                rootId={rootId!}
                selectedParentId={manageParentId}
                focusDossierId={focusDossierId}
                onClearFocusDossier={clearFocusDossier}
                onSelectParent={(id) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      parentId: id,
                      tab: 'manage',
                      warehouseId: prev.warehouseId,
                      focusDossierId: undefined,
                    }),
                  })
                }}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <LocationListPanel
            parentId={locationsViewParentId}
            onNavigateToItem={navigateToLocationItem}
            onNavigateBack={navigateBackFromLocationDrillDown}
          />
        </div>
      )}
    </WarehousePageShell>
  )
}
