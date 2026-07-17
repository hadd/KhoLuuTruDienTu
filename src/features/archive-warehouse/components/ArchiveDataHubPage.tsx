import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  FolderOpen,
  Send,
  Settings2,
  Shield,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArchiveFieldConfigPage } from '@/features/archive-config/components/ArchiveFieldConfigPage'
import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { ArchivePermissionConfigPage } from '@/features/archive-permission/components/ArchivePermissionConfigPage'
import { ArchiveReviewPage } from '@/features/archive-review/components/ArchiveReviewPage'
import { ArchiveSubmissionPage } from '@/features/archive-submission/components/ArchiveSubmissionPage'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { ArchiveWarehouseFondsPage } from '@/features/archive-warehouse/components/ArchiveWarehouseFondsPage'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { isArchiveDataHubTab } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import {
  WarehouseSectionTabs,
} from '@/features/warehouse-management/components/WarehouseSectionTabs'
import {
  warehouseSubTabsListClassName,
  warehouseSubTabsTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'

const routeApi = getRouteApi('/app/archive-warehouse/')

const TAB_ICONS: Record<
  ArchiveDataHubTabT,
  typeof FolderOpen
> = {
  dossiers: FolderOpen,
  submission: Send,
  review: CheckCircle2,
  config: Settings2,
  permission: Shield,
}

export function ArchiveDataHubPage() {
  const { t } = useTranslation('archive-warehouse')
  const search = routeApi.useSearch()
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenPermissionTab =
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  const availableTabs = useMemo(() => {
    const tabs: Array<{ value: ArchiveDataHubTabT; label: string }> = []
    if (canReadArchiveWarehouse) {
      tabs.push({ value: 'dossiers', label: t('tabs.dossiers') })
    }
    if (canSubmitArchive) {
      tabs.push({ value: 'submission', label: t('tabs.submission') })
    }
    if (canReviewArchive) {
      tabs.push({ value: 'review', label: t('tabs.review') })
    }
    if (canManageArchiveConfig) {
      tabs.push({ value: 'config', label: t('tabs.config') })
    }
    if (canOpenPermissionTab) {
      tabs.push({ value: 'permission', label: t('tabs.permission') })
    }
    return tabs
  }, [
    canReadArchiveWarehouse,
    canSubmitArchive,
    canReviewArchive,
    canManageArchiveConfig,
    canOpenPermissionTab,
    t,
  ])

  const tab = (search.tab ?? availableTabs[0]?.value ?? 'dossiers') as ArchiveDataHubTabT

  useEffect(() => {
    if (availableTabs.length === 0) return
    if (!availableTabs.some((item) => item.value === tab)) {
      void navigate({
        search: (prev) => ({ ...prev, tab: availableTabs[0].value, page: 1 }),
        replace: true,
      })
    }
  }, [availableTabs, tab, navigate])

  function setTab(nextTab: ArchiveDataHubTabT) {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: nextTab,
        page: 1,
        q: undefined,
        status: undefined,
      }),
    })
  }

  if (availableTabs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('hub.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden">
      <WarehouseSectionTabs active="data" compact />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isArchiveDataHubTab(value)) setTab(value)
        }}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <TabsList className={warehouseSubTabsListClassName}>
          {availableTabs.map((item) => {
            const Icon = TAB_ICONS[item.value]
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className={warehouseSubTabsTriggerClassName}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === 'dossiers' && canReadArchiveWarehouse ? (
            <ArchiveWarehouseFondsPage embedded />
          ) : null}
          {tab === 'submission' && canSubmitArchive ? (
            <ArchiveSubmissionPage embedded />
          ) : null}
          {tab === 'review' && canReviewArchive ? (
            <ArchiveReviewPage embedded />
          ) : null}
          {tab === 'config' && canManageArchiveConfig ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ArchiveFieldConfigPage embedded />
            </div>
          ) : null}
          {tab === 'permission' && canOpenPermissionTab ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ArchivePermissionConfigPage embedded />
            </div>
          ) : null}
        </div>
      </Tabs>
    </div>
  )
}
