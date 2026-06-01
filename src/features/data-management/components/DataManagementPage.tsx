import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, FolderUp } from 'lucide-react'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import type { DataNodeActionDialogMode } from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeActionDialogs } from '@/features/data-management/components/DataNodeActionDialogs'
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
  findAllMetadataGroupIndicesForDocument,
  findMetadataGroupIndexForDocument,
} from '@/features/data-management/lib/metadataHelpers'
import {
  filterTreeForSearch,
  findNodeById,
  findParentNode,
  reloadTreePathToNode,
  resolveDefaultDocumentNodeId,
  resolveRecordDossierId,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryOptions,
  useLoadNodeChildrenMutation,
  useRefreshDataManagementTreeMutation,
  useRefreshEditorDossierMutation,
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
  const refreshEditorDossierMutation = useRefreshEditorDossierMutation()

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

    function redirectDocumentToRecord(documentNode: DataTreeNodeT) {
      if (!documentNode.parentId) return false
      const parent = findNodeById(tree, documentNode.parentId)
      if (parent?.type !== 'record') return false
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: parent.id,
          focusDocumentId: documentNode.id,
        }),
        replace: true,
      })
      return true
    }

    if (!nodeId || !findNodeById(tree, nodeId)) {
      const defaultNodeId = resolveDefaultDocumentNodeId(tree, role)
      const defaultNode = findNodeById(tree, defaultNodeId)
      if (defaultNode?.type === 'document' && redirectDocumentToRecord(defaultNode)) {
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

    const currentNode = findNodeById(tree, nodeId)
    if (currentNode?.type === 'document' && redirectDocumentToRecord(currentNode)) {
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
      const parent = selectedNode.parentId
        ? findNodeById(tree, selectedNode.parentId)
        : null
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

  const contextMenuParent = useMemo(() => {
    if (!tree || !contextMenu?.node) return null
    return findParentNode(tree, contextMenu.node.id)
  }, [tree, contextMenu?.node])

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

  function navigateToNode(id: string) {
    if (!tree) {
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

    const targetNode = findNodeById(tree, id)
    if (targetNode?.type === 'document' && targetNode.parentId) {
      const parent = findNodeById(tree, targetNode.parentId)
      if (parent?.type === 'record') {
        const recordDocuments = parent.children.filter(
          (child) => child.type === 'document',
        )
        const metadataGroups = parent.dossierMetadata?.metadata_groups ?? []
        const matchingGroupIndices = findAllMetadataGroupIndicesForDocument(
          metadataGroups,
          targetNode,
          recordDocuments,
        )
        const isRepeatDocumentClick =
          nodeId === parent.id &&
          focusDocumentId === targetNode.id &&
          matchingGroupIndices.length > 1

        let nextGroupIndex: number | undefined
        if (matchingGroupIndices.length > 1) {
          if (isRepeatDocumentClick) {
            const currentGroupIndex =
              focusGroupIndex ??
              findMetadataGroupIndexForDocument(
                metadataGroups,
                targetNode,
                recordDocuments,
              )
            const currentPosition = matchingGroupIndices.indexOf(
              currentGroupIndex,
            )
            const basePosition = currentPosition >= 0 ? currentPosition : 0
            nextGroupIndex =
              matchingGroupIndices[
                (basePosition + 1) % matchingGroupIndices.length
              ]
          } else {
            nextGroupIndex = findMetadataGroupIndexForDocument(
              metadataGroups,
              targetNode,
              recordDocuments,
            )
          }
        }

        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            nodeId: parent.id,
            focusDocumentId: targetNode.id,
            focusGroupIndex: nextGroupIndex,
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

  async function handleMetadataReload(reloadDossierId: string) {
    try {
      if (role === 'editor') {
        await refreshEditorDossierMutation.mutateAsync(reloadDossierId)
        return
      }

      const targetNodeId = focusDocumentId ?? nodeId
      const freshTree = await refreshTreeMutation.mutateAsync(undefined)
      if (targetNodeId) {
        await reloadTreePathToNode(freshTree, targetNodeId, (id) =>
          loadChildrenMutation.mutateAsync(id),
        )
      }
    } catch {
      // toast already shown by mutation error handlers when applicable
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
                  loadChildrenMutation.mutate(id)
                  navigateToNode(id)
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
                loadChildrenMutation.mutate(id)
                navigateToNode(id)
              }}
              onWorkflowComplete={(dossierId) => void handleMetadataReload(dossierId)}
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
        parentNode={contextMenuParent}
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
