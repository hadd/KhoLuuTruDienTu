import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    ? `flex flex-1 min-h-0 flex-col gap-4 overflow-hidden py-4 pr-4 ${
        roleSidebarCollapsed ? 'pl-0' : 'pl-4'
      }`
    : '-m-6 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden p-4'
  const showSearch = true

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

  const orderedNodes = useMemo(() => {
    if (!tree) return [] as Array<DataTreeNodeT>
    const nodes: Array<DataTreeNodeT> = []

    function visit(node: DataTreeNodeT) {
      if (node.parentId !== null) {
        if (role === 'editor') {
          if (node.type === 'document') nodes.push(node)
        } else if (node.type === 'record' || node.type === 'document') {
          nodes.push(node)
        }
      }
      node.children.forEach(visit)
    }

    visit(tree)
    return nodes
  }, [tree, role])

  function handleAdvanceFromNode(currentId: string) {
    if (!tree) return
    const currentIndex = orderedNodes.findIndex((node) => node.id === currentId)
    if (currentIndex < 0 || currentIndex >= orderedNodes.length - 1) return
    const nextNode = orderedNodes[currentIndex + 1]
    void (navigate as any)({
      search: (prev: any) => ({ ...prev, nodeId: nextNode.id }),
    })
  }

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
        <DataManagementToolbar
          onUploadClick={() => setUploadOpen(true)}
          permissions={permissions}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {treeCollapsed ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-start border-b border-border px-3 py-3">
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
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              <DataTreeBreadcrumb tree={tree} nodeId={nodeId} />
              <DataNodeDetailPanel
                node={selectedNode}
                role={role}
                onSelectNode={(id) => {
                  void (navigate as any)({
                    search: (prev: any) => ({ ...prev, nodeId: id }),
                  })
                }}
                onAdvance={handleAdvanceFromNode}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-72 min-w-[18rem] flex-col border-r border-border bg-card">
              <div className="flex items-center justify-start border-b border-border px-3 py-3">
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
              {showSearch ? (
                <div className="border-b border-border px-3 py-3">
                  <Input
                    className="border-input bg-background"
                    placeholder={t('search.placeholder')}
                    value={q}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    aria-label={t('search.placeholder')}
                  />
                </div>
              ) : null}
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
                />
              ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              <DataTreeBreadcrumb tree={tree} nodeId={nodeId} />
              <DataNodeDetailPanel
                node={selectedNode}
                role={role}
                onSelectNode={(id) => {
                  void (navigate as any)({
                    search: (prev: any) => ({ ...prev, nodeId: id }),
                  })
                }}
                onAdvance={handleAdvanceFromNode}
              />
            </div>
          </>
        )}
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
