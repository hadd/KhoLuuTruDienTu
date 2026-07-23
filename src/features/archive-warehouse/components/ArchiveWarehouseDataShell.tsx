import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  FolderOpen,
  Send,
  Settings2,
  Shield,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import {
  ArchiveWarehouseBrowseTabs,
  type ArchiveWarehouseBrowseViewT,
} from '@/features/archive-warehouse/components/ArchiveWarehouseBrowseTabs'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import {
  warehouseSubTabsListClassName,
  warehouseSubTabsTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { WarehouseSectionTabs } from '@/features/warehouse-management/components/WarehouseSectionTabs'
import { cn } from '@/lib/utils/cn'

const TAB_ICONS: Record<ArchiveDataHubTabT, typeof FolderOpen> = {
  dossiers: FolderOpen,
  submission: Send,
  review: CheckCircle2,
  config: Settings2,
  permission: Shield,
}

type ArchiveWarehouseDataShellProps = {
  activeTab: ArchiveDataHubTabT
  children: React.ReactNode
  browseView?: ArchiveWarehouseBrowseViewT
  showBrowseTabs?: boolean
}

function ArchiveWarehouseDataShellBrowseTabs({
  browseView,
}: {
  browseView: ArchiveWarehouseBrowseViewT
}) {
  const navigate = useNavigate()

  function setBrowseView(next: ArchiveWarehouseBrowseViewT) {
    void navigate({
      to: '/app/archive-warehouse',
      search: {
        tab: 'dossiers',
        browseView: next,
        page: 1,
      },
    })
  }

  return (
    <ArchiveWarehouseBrowseTabs
      browseView={browseView}
      onBrowseViewChange={setBrowseView}
    />
  )
}

export function ArchiveWarehouseDataShell({
  activeTab,
  children,
  browseView = 'fonds',
  showBrowseTabs = false,
}: ArchiveWarehouseDataShellProps) {
  const { t } = useTranslation('archive-warehouse')
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

  return (
    <div className="-mx-6 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6">
      <WarehouseSectionTabs active="data" compact />

      {availableTabs.length > 0 ? (
        <nav
          className={cn(warehouseSubTabsListClassName, 'min-w-0')}
          aria-label={t('hub.title')}
        >
          {availableTabs.map((item) => {
            const Icon = TAB_ICONS[item.value]
            const isActive = item.value === activeTab
            return (
              <Link
                key={item.value}
                to="/app/archive-warehouse"
                search={{ tab: item.value, page: 1 }}
                className={cn(
                  warehouseSubTabsTriggerClassName,
                  'inline-flex items-center',
                )}
                data-state={isActive ? 'active' : 'inactive'}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {showBrowseTabs && activeTab === 'dossiers' ? (
        <div className="min-w-0">
          <ArchiveWarehouseDataShellBrowseTabs browseView={browseView} />
        </div>
      ) : null}

      <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </div>
    </div>
  )
}
