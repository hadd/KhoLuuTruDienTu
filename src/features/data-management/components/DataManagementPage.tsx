import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import { DataManagementToolbar } from '@/features/data-management/components/DataManagementToolbar'
import {
  DataNodeActionDialogs,
  type DataNodeActionDialogMode,
} from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { MOCK_DATA_ROOT_ID } from '@/features/data-management/lib/mockData'
import {
  filterTreeForSearch,
  findNodeById,
} from '@/features/data-management/lib/treeUtils'
import { dataManagementTreeQueryOptions } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'

const routeApi = getRouteApi('/admin/data/')

export function DataManagementPage() {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
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

  const {
    data: tree,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery(dataManagementTreeQueryOptions())

  const q = search.q ?? ''
  const nodeId = search.nodeId

  useEffect(() => {
    if (!tree) return
    if (!nodeId || !findNodeById(tree, nodeId)) {
      void navigate({
        search: (prev) => ({ ...prev, nodeId: MOCK_DATA_ROOT_ID }),
        replace: true,
      })
    }
  }, [tree, nodeId, navigate])

  function handleSearchInput(raw: string) {
    void navigate({
      search: (prev) => ({ ...prev, q: raw.trim() ? raw : undefined }),
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

  return (
    <div className="-m-6 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden p-6">
      <div className="shrink-0 space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <DataManagementToolbar
        searchQuery={q}
        onSearchChange={handleSearchInput}
        onUploadClick={() => setUploadOpen(true)}
      />

      <div className="min-h-0 shrink-0">
        <DataTreeBreadcrumb tree={tree} nodeId={nodeId} />
      </div>

      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 flex-1 rounded-lg border border-border"
      >
        <ResizablePanel
          defaultSize={32}
          minSize={22}
          className="flex min-h-0 min-w-0 flex-col"
        >
          {displayTree ? (
            <DataFolderTree
              tree={displayTree}
              selectedId={nodeId}
              onSelect={(id) => {
                void navigate({
                  search: (prev) => ({ ...prev, nodeId: id }),
                })
              }}
              onContextMenuNode={(node, x, y) =>
                setContextMenu({ node, x, y })
              }
            />
          ) : null}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={68}
          minSize={40}
          className="flex min-h-0 min-w-0 flex-col p-3"
        >
          <DataNodeDetailPanel
            node={selectedNode}
            onSelectNode={(id) => {
              void navigate({
                search: (prev) => ({ ...prev, nodeId: id }),
              })
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <FolderUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <DataNodeActionDialogs
        node={actionState?.node ?? null}
        mode={actionState?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setActionState(null)
        }}
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
      />
      <DataNodeDetailModal
        node={viewInfoNode}
        open={viewInfoOpen}
        onOpenChange={(open) => {
          setViewInfoOpen(open)
          if (!open) setViewInfoNode(null)
        }}
      />
    </div>
  )
}
