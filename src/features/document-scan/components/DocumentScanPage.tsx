import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScanContextAction } from '@/features/document-scan/components/ScanContextMenu'
import { ScanContextMenu } from '@/features/document-scan/components/ScanContextMenu'
import { ScanDeleteDialog } from '@/features/document-scan/components/ScanDeleteDialog'
import { ScanDetailPanel } from '@/features/document-scan/components/ScanDetailPanel'
import { ScanNodeFormDialog } from '@/features/document-scan/components/ScanNodeFormDialog'
import { ScanTree } from '@/features/document-scan/components/ScanTree'
import { ScanUploadToolbar } from '@/features/document-scan/components/ScanUploadToolbar'
import { getChildNodeType } from '@/features/document-scan/lib/scanTreeUtils'
import {
  scanWorkspaceQueryOptions,
  useDeleteScanNodeMutation,
} from '@/features/document-scan/queries'
import type {
  ScanBranchNodeType,
  ScanTreeBranchT,
  ScanTreeNodeT,
} from '@/features/document-scan/types'

type DialogState =
  | { mode: 'closed' }
  | {
      mode: 'create' | 'edit'
      nodeType: ScanBranchNodeType
      parentId: string | null
      node?: ScanTreeNodeT
    }

type DeleteState = { open: false } | { open: true; node: ScanTreeNodeT }

export function DocumentScanPage() {
  const { t } = useTranslation('document-scan')
  const navigate = useNavigate({ from: '/app/document-scan/' })
  const search = useSearch({ from: '/app/document-scan/' })
  const { data: workspace } = useQuery(scanWorkspaceQueryOptions())
  const deleteNode = useDeleteScanNodeMutation()
  const [checkedIds, setCheckedIds] = useState<Array<string>>([])
  const [dialogState, setDialogState] = useState<DialogState>({
    mode: 'closed',
  })
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false })
  const [contextMenu, setContextMenu] = useState<{
    node: ScanTreeBranchT
    x: number
    y: number
  } | null>(null)

  const selectedId = search.selectedId
  const pageId = search.pageId

  const handleSelect = useCallback(
    (id: string) => {
      void navigate({
        to: '.',
        search: (prev) => ({ ...prev, selectedId: id }),
      })
    },
    [navigate],
  )

  const handleSelectPage = useCallback(
    (nextPageId: string) => {
      void navigate({
        to: '.',
        search: (prev) => ({ ...prev, pageId: nextPageId }),
      })
    },
    [navigate],
  )

  const handleClearPageSelection = useCallback(() => {
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, pageId: undefined }),
    })
  }, [navigate])

  const handleToggleCheck = useCallback((id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id]
      }
      return prev.filter((item) => item !== id)
    })
  }, [])

  const openCreateDialog = useCallback(
    (parentId: string | null, nodeType: ScanBranchNodeType) => {
      setDialogState({ mode: 'create', nodeType, parentId })
    },
    [],
  )

  const openEditDialog = useCallback((node: ScanTreeNodeT) => {
    setDialogState({
      mode: 'edit',
      nodeType: node.type,
      parentId: node.parentId,
      node,
    })
  }, [])

  const handleContextAction = useCallback(
    (node: ScanTreeBranchT, action: ScanContextAction) => {
      if (action === 'add-child') {
        const childType = getChildNodeType(node.type)
        if (!childType) return
        openCreateDialog(node.id, childType)
        return
      }
      if (action === 'edit') {
        openEditDialog(node)
        return
      }
      setDeleteState({ open: true, node })
    },
    [openCreateDialog, openEditDialog],
  )

  const handleUploaded = useCallback(() => {
    setCheckedIds([])
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, selectedId: undefined, pageId: undefined }),
    })
  }, [navigate])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteState.open) return
    const deletedId = deleteState.node.id
    await deleteNode.mutateAsync(deletedId)
    setDeleteState({ open: false })
    setCheckedIds((prev) => prev.filter((id) => id !== deletedId))
    if (selectedId === deletedId) {
      void navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          selectedId: undefined,
          pageId: undefined,
        }),
      })
    }
  }, [deleteNode, deleteState, navigate, selectedId])

  const dialogOpen = dialogState.mode !== 'closed'
  const dialogProps = useMemo(() => {
    if (dialogState.mode === 'closed') return null
    return dialogState
  }, [dialogState])

  if (!workspace) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col overflow-hidden -m-6"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
          <ScanUploadToolbar
            workspace={workspace}
            checkedIds={checkedIds}
            onUploaded={handleUploaded}
          />
          <ScanTree
            workspace={workspace}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onSelect={handleSelect}
            onToggleCheck={handleToggleCheck}
            onContextMenu={(node, x, y) => setContextMenu({ node, x, y })}
            onAddProject={() => openCreateDialog(null, 'project')}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <ScanDetailPanel
            workspace={workspace}
            selectedId={selectedId}
            pageId={pageId}
            onSelectPage={handleSelectPage}
            onClearPageSelection={handleClearPageSelection}
            onEditNode={openEditDialog}
            onDeleteNode={(node) => setDeleteState({ open: true, node })}
          />
        </section>
      </div>

      <ScanContextMenu
        node={contextMenu?.node ?? null}
        open={Boolean(contextMenu)}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onAction={handleContextAction}
        onClose={() => setContextMenu(null)}
      />

      {dialogProps ? (
        <ScanNodeFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) setDialogState({ mode: 'closed' })
          }}
          mode={dialogProps.mode}
          nodeType={dialogProps.nodeType}
          parentId={dialogProps.parentId}
          node={dialogProps.node}
          onSuccess={(node) => handleSelect(node.id)}
        />
      ) : null}

      {deleteState.open ? (
        <ScanDeleteDialog
          open={deleteState.open}
          onOpenChange={(open) => {
            if (!open) setDeleteState({ open: false })
          }}
          nodeType={deleteState.node.type}
          nodeName={deleteState.node.name}
          onConfirm={() => void handleDeleteConfirm()}
          isLoading={deleteNode.isPending}
        />
      ) : null}
    </div>
  )
}
