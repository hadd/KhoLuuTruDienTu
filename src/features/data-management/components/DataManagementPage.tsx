import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, FolderUp } from 'lucide-react'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import type {
  DataNodeActionDialogMode,
  DataNodeDeleteSuccessContextT,
} from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeActionDialogs } from '@/features/data-management/components/DataNodeActionDialogs'
import { clearLoadedNodeCache } from '@/features/data-management/api/dataManagementClient'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import { useDataManagementSocket } from '@/features/data-management/hooks/useDataManagementSocket'
import type { UploadFolderResult } from '@/features/data-management/api/dossierClient'
import {
  exportDossierMetadataExcel,
  exportFolderMetadataExcel,
} from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import { canExportDossierMetadata } from '@/features/data-management/lib/dossierStatusHelpers'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { resolveFolderIdFromStorageKey } from '@/features/data-management/lib/uploadFolderResolve'
import {
  filterTreeForSearch,
  findNodeById,
  findParentNode,
  findRecordParentForDocument,
  reloadTreePathToNode,
  resolveDefaultDocumentNodeId,
  resolveDocumentFocusNavigation,
  canExportFolderMetadata,
  resolveFolderExportId,
  resolveFoldersToReloadAfterDelete,
  resolveRecordDossierId,
  resolveSelectionAfterDelete,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
  useClaimNextMakerAssignmentMutation,
  useLoadNodeChildrenMutation,
  useRefreshDataManagementTreeMutation,
  useRefreshDossierContentMutation,
} from '@/features/data-management/queries'
import type { DataManagementSearch } from '@/features/data-management/schemas'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export interface DataManagementPageProps {
  role?: DataManagementRole
}

export function DataManagementPage({
  role = 'admin',
}: DataManagementPageProps) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
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

  const {
    data: tree,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(dataManagementTreeQueryOptions(role))

  const loadChildrenMutation = useLoadNodeChildrenMutation(role)
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(role)
  const refreshDossierMutation = useRefreshDossierContentMutation(role)
  const claimNextMutation = useClaimNextMakerAssignmentMutation()

  const q = typeof search.q === 'string' ? search.q : ''
  const nodeId = typeof search.nodeId === 'string' ? search.nodeId : undefined
  const focusDocumentId =
    typeof search.focusDocumentId === 'string'
      ? search.focusDocumentId
      : undefined
  const focusGroupIndex =
    typeof search.focusGroupIndex === 'number' &&
    Number.isFinite(search.focusGroupIndex)
      ? search.focusGroupIndex
      : undefined
  const containerClass =
    role === 'admin'
      ? '-m-6 flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4'
      : 'flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden'
  const showSearch = true

  useEffect(() => {
    if (!tree) return
    const currentTree = tree

    function redirectDocumentToRecord(documentNode: DataTreeNodeT) {
      const focus = resolveDocumentFocusNavigation(currentTree, documentNode.id)
      if (!focus) return false
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          ...focus,
        }),
        replace: true,
      })
      return true
    }

    if (!nodeId || !findNodeById(currentTree, nodeId)) {
      const defaultNodeId = resolveDefaultDocumentNodeId(currentTree, role)
      const defaultNode = findNodeById(currentTree, defaultNodeId)
      if (
        defaultNode?.type === 'document' &&
        redirectDocumentToRecord(defaultNode)
      ) {
        return
      }
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: defaultNodeId,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
        replace: true,
      })
      return
    }

    const currentNode = findNodeById(currentTree, nodeId)
    if (
      currentNode?.type === 'document' &&
      redirectDocumentToRecord(currentNode)
    ) {
      return
    }

    loadChildrenMutation.mutate(nodeId)
  }, [tree, nodeId, navigate, role])

  function handleSearchInput(raw: string) {
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        q: raw.trim() ? raw : undefined,
      }),
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

  const detailContext = useMemo(() => {
    if (!tree || !selectedNode) return null

    if (selectedNode.type === 'document') {
      const parent = findRecordParentForDocument(tree, selectedNode.id)
      if (parent?.type === 'record') {
        return {
          node: parent,
          focusDocumentId: selectedNode.id,
          focusGroupIndex,
          dossierId: resolveRecordDossierId(parent),
          dossierStatus: parent.dossierStatus,
        }
      }
    }

    if (selectedNode.type === 'record') {
      return {
        node: selectedNode,
        focusDocumentId,
        focusGroupIndex,
        dossierId: resolveRecordDossierId(selectedNode),
        dossierStatus: selectedNode.dossierStatus,
      }
    }

    return {
      node: selectedNode,
      focusDocumentId: undefined,
      focusGroupIndex: undefined,
      dossierId: null,
      dossierStatus: undefined,
    }
  }, [tree, selectedNode, focusDocumentId, focusGroupIndex])

  useDataManagementSocket({
    role,
    tree,
    nodeId,
    selectedNode: detailContext?.node ?? selectedNode,
    focusDocumentId,
    refreshDossier: (dossierId) =>
      refreshDossierMutation.mutateAsync(dossierId),
    refreshTree: (dossierId) => refreshTreeMutation.mutateAsync(dossierId),
    loadChildren: (id) => loadChildrenMutation.mutateAsync(id),
    claimNext:
      role === 'editor' ? () => claimNextMutation.mutateAsync() : undefined,
  })

  async function handleUploadSuccess(result: UploadFolderResult) {
    if (role !== 'admin') return

    const folderIds = new Set<string>()
    let navigateNodeId: string | null = null

    for (const item of result.results) {
      if (item.status !== 'uploaded' && item.status !== 'skipped') continue
      if (item.folderId) folderIds.add(item.folderId)
    }

    let workingTree = tree ?? (await refreshTreeMutation.mutateAsync(undefined))

    if (folderIds.size === 0 && workingTree) {
      const sample = result.results.find(
        (item) =>
          (item.status === 'uploaded' || item.status === 'skipped') &&
          item.storageKey,
      )
      if (sample?.storageKey) {
        const resolved = await resolveFolderIdFromStorageKey(
          workingTree,
          sample.storageKey,
          (nodeId) => loadChildrenMutation.mutateAsync(nodeId),
        )
        if (resolved) {
          folderIds.add(resolved.folderId)
          navigateNodeId = resolved.navigateNodeId
          workingTree =
            queryClient.getQueryData<DataTreeNodeT>(
              dataManagementTreeQueryKey(role),
            ) ?? workingTree
        }
      }
    }

    await refreshTreeMutation.mutateAsync(undefined)

    const targetNodeId =
      navigateNodeId ??
      [...folderIds].find((id) => id !== DATA_TREE_ROOT_ID) ??
      null

    if (targetNodeId) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: targetNodeId,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
    }
  }

  const contextMenuParent = useMemo(() => {
    if (!tree || !contextMenu?.node) return null
    return findParentNode(tree, contextMenu.node.id)
  }, [tree, contextMenu?.node])

  async function handleExportExcel(node: DataTreeNodeT) {
    if (canExportFolderMetadata(node)) {
      try {
        await exportFolderMetadataExcel(resolveFolderExportId(node), node.name)
        toast.success(t('recordDetail.exportExcelSuccess'))
      } catch {
        toast.error(t('recordDetail.exportExcelError'))
      }
      return
    }

    const dossierId = resolveRecordDossierId(node)
    if (!dossierId) return

    if (!canExportDossierMetadata(node.dossierStatus)) {
      toast.error(t('recordDetail.exportExcelNotApproved'))
      return
    }

    try {
      await exportDossierMetadataExcel(
        dossierId,
        node.dossierMetadata?.ho_so_id?.trim() || node.name,
      )
      toast.success(t('recordDetail.exportExcelSuccess'))
    } catch {
      toast.error(t('recordDetail.exportExcelError'))
    }
  }

  function handleFocusDocument(documentId: string, groupIndex: number) {
    if (!tree || !nodeId) return
    const recordNode = findNodeById(tree, nodeId)
    if (recordNode?.type !== 'record') return
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: recordNode.id,
        focusDocumentId: documentId,
        focusGroupIndex: groupIndex,
      }),
    })
  }

  function navigateToNode(id: string, treeOverride?: DataTreeNodeT) {
    const activeTree = treeOverride ?? tree

    if (!activeTree) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: id,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
      return
    }

    const targetNode = findNodeById(activeTree, id)
    if (targetNode?.type === 'document') {
      const focus = resolveDocumentFocusNavigation(activeTree, id, {
        nodeId,
        focusDocumentId,
        focusGroupIndex,
      })
      if (focus) {
        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            ...focus,
          }),
        })
        return
      }
    }

    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: id,
        focusDocumentId: undefined,
        focusGroupIndex: undefined,
      }),
    })
  }

  async function handleSelectNode(id: string) {
    let workingTree = tree

    try {
      if (workingTree) {
        const targetNode = findNodeById(workingTree, id)

        if (targetNode?.type === 'document') {
          const parent = findRecordParentForDocument(workingTree, id)
          const loadId = parent?.id ?? targetNode.parentId
          if (loadId) {
            const parentNode =
              parent ?? findNodeById(workingTree, loadId) ?? null
            if (
              !parentNode ||
              parentNode.type !== 'record' ||
              !parentNode.dossierMetadata
            ) {
              workingTree = await loadChildrenMutation.mutateAsync(loadId)
            }
          }
        } else if (targetNode?.type === 'folder' && role === 'admin') {
          workingTree = await loadChildrenMutation.mutateAsync(id)
        } else {
          loadChildrenMutation.mutate(id)
        }
      }
    } catch {
      toast.error(t('errors.loadFailed'))
      return
    }

    navigateToNode(id, workingTree ?? undefined)
  }

  async function handleDeleteSuccess({
    deletedNodeId,
  }: DataNodeDeleteSuccessContextT) {
    if (!tree) return

    const reloadFolderIds = resolveFoldersToReloadAfterDelete(tree, deletedNodeId)
    clearLoadedNodeCache(deletedNodeId)

    for (const folderId of reloadFolderIds) {
      clearLoadedNodeCache(folderId)
      try {
        await loadChildrenMutation.mutateAsync(folderId)
      } catch {
        toast.error(t('errors.loadFailed'))
      }
    }

    const nextNodeId = resolveSelectionAfterDelete(tree, deletedNodeId, nodeId)
    if (nextNodeId) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: nextNodeId,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
    }
  }

  async function handleMetadataReload(_reloadDossierId: string) {
    try {
      if (role === 'editor') {
        await claimNextMutation.mutateAsync()
        return
      }

      const targetNodeId = focusDocumentId ?? nodeId
      const freshTree = await refreshTreeMutation.mutateAsync(undefined)
      if (targetNodeId) {
        await reloadTreePathToNode(freshTree, targetNodeId, (loadId) =>
          loadChildrenMutation.mutateAsync(loadId),
        )
      }
    } catch (reloadError) {
      if (role === 'editor' && isNoAssignedDossierError(reloadError)) {
        toast.info(t('errors.noAssignedDossier'))
        return
      }
      toast.error(t('errors.loadFailed'))
      throw new Error('metadata reload failed')
    }
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
            treeCollapsed
              ? 'w-0 min-w-0 opacity-0'
              : 'w-72 min-w-[18rem] opacity-100',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
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
                selectedId={focusDocumentId ?? nodeId}
                onSelect={(id) => {
                  void handleSelectNode(id)
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <DataNodeDetailPanel
              node={detailContext?.node ?? null}
              role={role}
              dossierId={detailContext?.dossierId}
              dossierStatus={detailContext?.dossierStatus}
              focusDocumentId={detailContext?.focusDocumentId}
              focusGroupIndex={detailContext?.focusGroupIndex}
              onFocusDocument={handleFocusDocument}
              onSelectNode={(id) => {
                void handleSelectNode(id)
              }}
              onWorkflowComplete={handleMetadataReload}
            />
          </div>
        </div>
      </div>

      <FolderUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        role={role}
        onUploadSuccess={handleUploadSuccess}
      />
      <DataNodeActionDialogs
        node={actionState?.node ?? null}
        mode={actionState?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setActionState(null)
        }}
        role={role}
        tree={tree}
        onEnsureNodeLoaded={async (id) => {
          const updatedTree = await loadChildrenMutation.mutateAsync(id)
          return findNodeById(updatedTree, id)
        }}
        onDeleteSuccess={handleDeleteSuccess}
      />
      <DataNodeContextMenu
        node={contextMenu?.node ?? null}
        parentNode={contextMenuParent}
        open={!!contextMenu}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onAction={(node, mode) => setActionState({ node, mode })}
        onViewInfo={(node) => {
          setViewInfoNode(node)
          setViewInfoOpen(true)
        }}
        onExportExcel={(node) => void handleExportExcel(node)}
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
