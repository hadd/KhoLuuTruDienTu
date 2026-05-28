import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, FolderUp } from 'lucide-react'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import type { DataNodeActionDialogMode } from '@/features/data-management/components/DataNodeActionDialogs'
import {
  DataNodeActionDialogs,
} from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  filterTreeForSearch,
  findNodeById,
  getRecordDocuments,
  resolveDefaultDocumentNodeId,
  resolveRecordDossierId,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
  useLoadNodeChildrenMutation,
} from '@/features/data-management/queries'
import type { DataManagementSearch } from '@/features/data-management/schemas'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

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
  const [treeCollapsed, setTreeCollapsed] = useState(false)

  const queryClient = useQueryClient()
  const {
    data: tree,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(dataManagementTreeQueryOptions(role))

  const loadChildrenMutation = useLoadNodeChildrenMutation(role)

  const q = typeof search.q === 'string' ? search.q : ''
  const nodeId = typeof search.nodeId === 'string' ? search.nodeId : undefined
  const containerClass =
    role === 'admin'
      ? '-m-6 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden p-4'
      : 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'
  const showSearch = true

  useEffect(() => {
    if (!tree) return
    if (!nodeId || !findNodeById(tree, nodeId)) {
      const defaultNodeId = resolveDefaultDocumentNodeId(tree, role)
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: defaultNodeId,
        }),
        replace: true,
      })
    } else {
      // Automatically load children for the initialized node if not loaded yet
      loadChildrenMutation.mutate(nodeId)
    }
  }, [tree, nodeId, navigate, role])

  function handleSearchInput(raw: string) {
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({ ...prev, q: raw.trim() ? raw : undefined }),
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

  const documentContext = useMemo(() => {
    if (!tree || !selectedNode || selectedNode.type !== 'document') return null

    const parent = selectedNode.parentId
      ? findNodeById(tree, selectedNode.parentId)
      : null
    const recordDocuments = getRecordDocuments(tree, selectedNode.id)
    const currentIndex = recordDocuments.findIndex(
      (document) => document.id === selectedNode.id,
    )

    return {
      dossierId: resolveRecordDossierId(parent),
      dossierMetadata: parent?.dossierMetadata,
      dossierStatus: parent?.dossierStatus,
      isLastDocument:
        currentIndex >= 0 && currentIndex === recordDocuments.length - 1,
      recordDocuments,
    }
  }, [tree, selectedNode])

  function handleAdvanceFromNode(currentId: string) {
    if (!tree) return
    const recordDocuments = getRecordDocuments(tree, currentId)
    const currentIndex = recordDocuments.findIndex(
      (document) => document.id === currentId,
    )
    if (currentIndex < 0 || currentIndex >= recordDocuments.length - 1) return
    const nextNode = recordDocuments[currentIndex + 1]
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({ ...prev, nodeId: nextNode.id }),
    })
  }


  function handleQcWorkflowComplete() {
    const currentTree = queryClient.getQueryData<DataTreeNodeT>(
      dataManagementTreeQueryKey(role),
    )
    if (!currentTree) return
    const nextNodeId = resolveDefaultDocumentNodeId(currentTree, role)
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({ ...prev, nodeId: nextNodeId }),
    })
  }

  if (isError) {
    if (role === 'editor' && isNoAssignedDossierError(error)) {
      return (
        <div className={containerClass}>
          <EditorNoAssignmentState />
        </div>
      )
    }

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
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <div
          className={cn(
            'flex flex-col overflow-hidden border-r border-border bg-card transition-[width,opacity] duration-300 ease-in-out',
            treeCollapsed ? 'w-0 min-w-0 opacity-0' : 'w-72 min-w-[18rem] opacity-100',
          )}
        >
          <div
            className={cn(
              'flex flex-1 flex-col',
              treeCollapsed && 'pointer-events-none',
            )}
          >
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
                  loadChildrenMutation.mutate(id)
                  void navigate({
                    to: '.',
                    search: (prev: DataManagementSearch) => ({ ...prev, nodeId: id }),
                  })
                }}
                onContextMenuNode={
                  permissions.canContextMenu
                    ? (node, x, y) => setContextMenu({ node, x, y })
                    : undefined
                }
                onExpandNode={(id) => {
                  loadChildrenMutation.mutate(id)
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTreeCollapsed((prev) => !prev)}
              aria-label={treeCollapsed ? t('tree.expand') : t('tree.collapse')}
            >
              {treeCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </Button>
            <div className="min-w-0 flex-1">
              <DataTreeBreadcrumb tree={tree} nodeId={nodeId} role={role} />
            </div>
            {permissions.canUpload && (
              <Button
                type="button"
                variant="default"
                className="shrink-0 gap-2"
                onClick={() => setUploadOpen(true)}
              >
                <FolderUp className="size-4" aria-hidden />
                {t('actions.uploadFolder')}
              </Button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <DataNodeDetailPanel
              node={selectedNode}
              role={role}
              dossierId={documentContext?.dossierId}
              dossierMetadata={documentContext?.dossierMetadata}
              dossierStatus={documentContext?.dossierStatus}
              isLastDocument={documentContext?.isLastDocument ?? false}
              onSelectNode={(id) => {
                void navigate({
                  to: '.',
                  search: (prev: DataManagementSearch) => ({ ...prev, nodeId: id }),
                })
              }}
              onAdvance={handleAdvanceFromNode}
              onWorkflowComplete={
                role === 'qc' ? handleQcWorkflowComplete : undefined
              }
            />
          </div>
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
        onEnsureNodeLoaded={async (id) => {
          const updatedTree = await loadChildrenMutation.mutateAsync(id)
          return findNodeById(updatedTree, id)
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

  return <div className={containerClass}>{content}</div>
}
