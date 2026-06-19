import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  clearLoadedNodeCache,
  isNodeChildrenCached,
  removeNodeFromTree,
} from '@/features/data-management/api/dataManagementClient'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import { useDataManagementProjectSelection } from '@/features/data-management/hooks/useDataManagementProjectSelection'
import {
  useDataManagementOcrSocket,
  type OcrTerminalCompletePayloadT,
} from '@/features/data-management/hooks/useDataManagementOcrSocket'
import { logOcrSocketDebug } from '@/features/data-management/lib/dossierSocket'
import type { UploadFolderResult } from '@/features/data-management/api/dossierClient'
import {
  exportDossierMetadataExcel,
  exportFolderMetadataExcel,
} from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { canExportDossierMetadata } from '@/features/data-management/lib/dossierStatusHelpers'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { resolveFolderIdFromStorageKey, discoverOcrWatchTargets } from '@/features/data-management/lib/uploadFolderResolve'
import {
  collectOcrRoomIdsFromTree,
  filterTreeForSearch,
  findNodeById,
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
  dataManagementProjectsQueryOptions,
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
  useClaimNextMakerAssignmentMutation,
  useLoadNodeChildrenMutation,
  useRefreshDataManagementTreeMutation,
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
  const [ocrWatchFolderIds, setOcrWatchFolderIds] = useState<Array<string>>([])
  const [ocrWatchDossierIds, setOcrWatchDossierIds] = useState<Array<string>>([])

  const { projectCode, handleProjectChange, syncProjectFromNode } =
    useDataManagementProjectSelection()
  const isAdmin = role === 'admin'

  const { data: projectsData, isPending: isProjectsPending } = useQuery({
    ...dataManagementProjectsQueryOptions(),
    enabled: isAdmin,
  })

  const {
    data: tree,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(dataManagementTreeQueryOptions(role, projectCode))

  const loadChildrenMutation = useLoadNodeChildrenMutation(role, projectCode)
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(
    role,
    projectCode,
  )
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
  const needsProjectSelection = isAdmin && !projectCode?.trim()
  const containerClass =
    '-m-6 flex h-[calc(100vh-3rem)] min-h-0 flex-col overflow-hidden p-4'
  const showSearch = true
  const treeReady = Boolean(tree)
  const ocrBootstrapDoneRef = useRef(false)

  const handleOcrTerminalComplete = useCallback(
    (payload: OcrTerminalCompletePayloadT) => {
      setOcrWatchFolderIds((prev) =>
        prev.filter((folderId) => folderId !== payload.folderId),
      )
      setOcrWatchDossierIds((prev) =>
        prev.filter((id) => id !== payload.dossierId),
      )
    },
    [],
  )

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
  }, [tree, nodeId, navigate, role])

  useEffect(() => {
    if (!treeReady || !tree || !nodeId) return
    if (!findNodeById(tree, nodeId)) return
    if (isNodeChildrenCached(nodeId)) return
    loadChildrenMutation.mutate(nodeId)
  }, [nodeId, role, treeReady, loadChildrenMutation])

  function loadNodeTree(
    loadNodeId: string,
    options?: { refresh?: boolean },
  ): Promise<DataTreeNodeT> {
    const input = options?.refresh
      ? { nodeId: loadNodeId, refresh: true }
      : loadNodeId
    return loadChildrenMutation
      .mutateAsync(input)
      .then((result) => result.tree)
  }

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

  useDataManagementOcrSocket({
    role,
    tree,
    selectedNode: detailContext?.node ?? selectedNode,
    dossierId: detailContext?.dossierId,
    extraWatchFolderIds: ocrWatchFolderIds,
    extraWatchDossierIds: ocrWatchDossierIds,
    enabled: Boolean(tree) && !isError,
    onOcrTerminalComplete: handleOcrTerminalComplete,
  })

  useEffect(() => {
    if (role !== 'admin' || !tree || isError || ocrBootstrapDoneRef.current) {
      return
    }

    ocrBootstrapDoneRef.current = true

    const { folderIds, dossierIds } = collectOcrRoomIdsFromTree(tree)

    logOcrSocketDebug('bootstrap watch ids', { folderIds, dossierIds })

    if (folderIds.length > 0) {
      setOcrWatchFolderIds((prev) => [...new Set([...prev, ...folderIds])])
    }
    if (dossierIds.length > 0) {
      setOcrWatchDossierIds((prev) => [...new Set([...prev, ...dossierIds])])
    }
  }, [isError, role, tree])

  async function handleUploadSuccess(result: UploadFolderResult) {
    if (role !== 'admin') return

    try {
      const folderIds = new Set<string>()
      const dossierIds = new Set<string>()

      for (const item of result.results) {
        if (item.status !== 'uploaded' && item.status !== 'skipped') continue
        if (item.folderId) folderIds.add(item.folderId)
        if (item.dossierId) dossierIds.add(item.dossierId)
      }

      const sample = result.results.find(
        (item) =>
          (item.status === 'uploaded' || item.status === 'skipped') &&
          item.storageKey,
      )

      const cachedTree =
        tree ??
        queryClient.getQueryData<DataTreeNodeT>(
          dataManagementTreeQueryKey(role, projectCode),
        )

      async function tryResolveFolderIds(workingTree: DataTreeNodeT) {
        if (folderIds.size > 0 || !sample?.storageKey) return

        const resolved = await resolveFolderIdFromStorageKey(
          workingTree,
          sample.storageKey,
          loadNodeTree,
        )
        if (!resolved) return

        folderIds.add(resolved.folderId)
      }

      if (cachedTree) {
        await tryResolveFolderIds(cachedTree)
      }

      const freshTree = await refreshTreeMutation.mutateAsync(undefined)
      await tryResolveFolderIds(freshTree)

      const discovered = await discoverOcrWatchTargets(
        freshTree,
        loadNodeTree,
        folderIds.size > 0 ? [...folderIds] : undefined,
      )
      for (const folderId of discovered.folderIds) folderIds.add(folderId)
      for (const dossierId of discovered.dossierIds) dossierIds.add(dossierId)

      logOcrSocketDebug('upload api ids', {
        fromApi: result.results
          .filter((item) => item.status === 'uploaded')
          .map((item) => ({
            storageKey: item.storageKey,
            folderId: item.folderId,
            dossierId: item.dossierId,
          })),
      })

      if (folderIds.size > 0) {
        setOcrWatchFolderIds((prev) => [...new Set([...prev, ...folderIds])])
      }
      if (dossierIds.size > 0) {
        setOcrWatchDossierIds((prev) => [...new Set([...prev, ...dossierIds])])
      }

      logOcrSocketDebug('upload watch ids', {
        folderIds: [...folderIds],
        dossierIds: [...dossierIds],
      })
    } catch {
      toast.error(t('upload.postProcessFailed'))
    }
  }

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

        if (
          isAdmin &&
          targetNode?.projectCode?.trim() &&
          targetNode.projectCode !== projectCode
        ) {
          syncProjectFromNode(targetNode.projectCode, id)
          return
        }

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
              workingTree = await loadNodeTree(loadId)
            }
          }
        } else if (targetNode?.type === 'folder' && role === 'admin') {
          if (!isNodeChildrenCached(id)) {
            workingTree = await loadNodeTree(id)
          }
        } else if (
          targetNode?.type === 'record' &&
          (!isNodeChildrenCached(id) || !targetNode.dossierMetadata)
        ) {
          loadChildrenMutation.mutate(id)
        } else if (!isNodeChildrenCached(id)) {
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
    const nextNodeId = resolveSelectionAfterDelete(tree, deletedNodeId, nodeId)

    const optimisticTree = removeNodeFromTree(deletedNodeId)
    if (optimisticTree) {
      queryClient.setQueryData(
        dataManagementTreeQueryKey(role, projectCode),
        optimisticTree,
      )
    }

    clearLoadedNodeCache(deletedNodeId)

    for (const folderId of reloadFolderIds) {
      clearLoadedNodeCache(folderId)
      try {
        await loadNodeTree(folderId, { refresh: true })
      } catch {
        toast.error(t('errors.loadFailed'))
      }
    }

    try {
      await refreshTreeMutation.mutateAsync(undefined)
    } catch {
      toast.error(t('errors.loadFailed'))
    }

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
        await reloadTreePathToNode(freshTree, targetNodeId, loadNodeTree)
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

  if (isAdmin && isProjectsPending) {
    return (
      <div className="flex h-[calc(100vh-3rem)] min-h-0 items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  if (isAdmin && !isProjectsPending && (projectsData?.items.length ?? 0) === 0) {
    return (
      <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('project.empty')}
        </p>
      </div>
    )
  }

  if (needsProjectSelection) {
    return (
      <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('project.selectPrompt')}
        </p>
        <ProjectSelect
          className="w-full max-w-sm"
          value={projectCode}
          onValueChange={handleProjectChange}
        />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-3rem)] min-h-0 items-center justify-center rounded-lg border border-border bg-card">
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
            {showSearch || isAdmin ? (
              <div className="space-y-2 border-b border-border px-3 py-3">
                {isAdmin ? (
                  <ProjectSelect
                    className="w-full"
                    value={projectCode}
                    onValueChange={handleProjectChange}
                  />
                ) : null}
                {showSearch ? (
                  <Input
                    className="border-input bg-background"
                    placeholder={t('search.placeholder')}
                    value={q}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    aria-label={t('search.placeholder')}
                  />
                ) : null}
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
                  void loadNodeTree(id).then((updatedTree) => {
                    const { folderIds, dossierIds } =
                      collectOcrRoomIdsFromTree(updatedTree)

                    logOcrSocketDebug('expand watch ids', { folderIds, dossierIds })

                    if (folderIds.length > 0) {
                      setOcrWatchFolderIds((prev) => [
                        ...new Set([...prev, ...folderIds]),
                      ])
                    }
                    if (dossierIds.length > 0) {
                      setOcrWatchDossierIds((prev) => [
                        ...new Set([...prev, ...dossierIds]),
                      ])
                    }
                  })
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
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
        projectCode={projectCode}
        onUploadSuccess={handleUploadSuccess}
      />
      <DataNodeActionDialogs
        node={actionState?.node ?? null}
        mode={actionState?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setActionState(null)
        }}
        role={role}
        projectCode={projectCode}
        tree={tree}
        onEnsureNodeLoaded={async (id) => {
          const updatedTree = await loadNodeTree(id)
          return findNodeById(updatedTree, id)
        }}
        onDeleteSuccess={handleDeleteSuccess}
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
