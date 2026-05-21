import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import { DataManagementToolbar } from '@/features/data-management/components/DataManagementToolbar'
import type { DataNodeActionDialogMode } from '@/features/data-management/components/DataNodeActionDialogs'
import {
  DataNodeActionDialogs,
} from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { RoleSidebar } from '@/features/data-management/components/RoleSidebar'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { MOCK_DATA_ROOT_ID } from '@/features/data-management/lib/mockData'
import {
  filterTreeForSearch,
  findNodeById,
} from '@/features/data-management/lib/treeUtils'
import { dataManagementTreeQueryOptions } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'

export interface DataManagementPageProps {
  role?: DataManagementRole
}

export function DataManagementPage({ role = 'admin' }: DataManagementPageProps) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const permissions = getPermissionsByRole(role)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [actionState, setActionState] = useState<{
    node: DataTreeNodeT
    mode: DataNodeActionDialogMode
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    node: DataTreeNodeT
    x: number
    y: number
  } | null>(null)
  const [viewInfoNode, setViewInfoNode] = useState<DataTreeNodeT | null>(null)
  const [viewInfoOpen, setViewInfoOpen] = useState(false)
  const [roleSidebarCollapsed, setRoleSidebarCollapsed] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(false)

  const {
    data: tree,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery(dataManagementTreeQueryOptions(role))

  const q = typeof search.q === 'string' ? search.q : ''
  const nodeId = typeof search.nodeId === 'string' ? search.nodeId : undefined
  const showRoleSidebar = role !== 'admin'
  const containerClass = showRoleSidebar
    ? 'flex flex-1 min-h-0 flex-col gap-4 overflow-hidden py-4 pr-4 pl-4'
    : '-m-6 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden p-4'
  const showHeader = role !== 'editor'

  useEffect(() => {
    if (!tree) return
    if (!nodeId || !findNodeById(tree, nodeId)) {
      void (navigate as any)({
        search: (prev: any) => ({ ...prev, nodeId: MOCK_DATA_ROOT_ID }),
        replace: true,
      })
    }
  }, [tree, nodeId, navigate])

  function handleSearchInput(raw: string) {
    void (navigate as any)({
      search: (prev: any) => ({ ...prev, q: raw.trim() ? raw : undefined }),
      replace: true,
    })
  }

  const displayTree = useMemo(() => {
    if (!tree) return null
    return filterTreeForSearch(tree, q)
  }, [tree, q])

  const selectedNode = useMemo(() => {
    if (!tree || !nodeId) return null
    return findNodeById(tree, nodeId)
  }, [tree, nodeId])

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-8rem)] min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          {tCommon('errors.tryAgain')}
        </Button>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-8rem)] min-h-[320px] items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  const content = (
    <>
      <div className="flex flex-col gap-[3px]">
        {showHeader ? (
          <div className="shrink-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        ) : null}

        <DataManagementToolbar
          searchQuery={q}
          onSearchChange={handleSearchInput}
          onUploadClick={() => setUploadOpen(true)}
          role={role}
          permissions={permissions}
        />
      </div>

      <div className="min-h-0 shrink-0">
        <DataTreeBreadcrumb tree={tree} nodeId={nodeId} />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <div
          className={
            treeCollapsed
              ? 'flex w-14 min-w-[3.5rem] flex-col border-r border-border bg-card'
              : 'flex w-72 min-w-[18rem] flex-col border-r border-border bg-card'
          }
        >
          <div className="flex items-center justify-end border-b border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTreeCollapsed((prev) => !prev)}
              aria-label={t('tree.collapse')}
            >
              <Menu className="size-4" />
            </Button>
          </div>
          {displayTree ? (
            <DataFolderTree
              tree={displayTree}
              selectedId={nodeId}
              onSelect={(id) => {
                void (navigate as any)({
                  search: (prev: any) => ({ ...prev, nodeId: id }),
                })
              }}
              onContextMenuNode={
                permissions.canContextMenu
                  ? (node, x, y) => setContextMenu({ node, x, y })
                  : undefined
              }
              collapsed={treeCollapsed}
            />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <DataNodeDetailPanel
            node={selectedNode}
            role={role}
            onSelectNode={(id) => {
              void (navigate as any)({
                search: (prev: any) => ({ ...prev, nodeId: id }),
              })
            }}
          />
        </div>
      </div>

      <FolderUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        role={role}
      />
      <DataNodeActionDialogs
        node={actionState?.node ?? null}
        mode={actionState?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setActionState(null)
        }}
        role={role}
      />
      <DataNodeContextMenu
        node={contextMenu?.node ?? null}
        open={!!contextMenu}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onAction={(node, mode) => setActionState({ node, mode })}
        onViewInfo={(node) => {
          setViewInfoNode(node)
          setViewInfoOpen(true)
        }}
        onClose={() => setContextMenu(null)}
        role={role}
        permissions={permissions}
      />
      <DataNodeDetailModal
        node={viewInfoNode}
        open={viewInfoOpen}
        onOpenChange={(open) => {
          setViewInfoOpen(open)
          if (!open) setViewInfoNode(null)
        }}
      />
    </>
  )

  return (
    <div className="flex min-h-0 flex-1">
      {showRoleSidebar ? (
        <div className="flex min-h-0 flex-1">
          <div className={roleSidebarCollapsed ? 'w-14' : 'w-56'}>
            <RoleSidebar
              role={role}
              collapsed={roleSidebarCollapsed}
              onToggleCollapse={() =>
                setRoleSidebarCollapsed((prev) => !prev)
              }
            />
          </div>
          <div className={containerClass}>{content}</div>
        </div>
      ) : (
        <div className={containerClass}>{content}</div>
      )}
    </div>
  )
}
