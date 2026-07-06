import { FolderPlus, Loader2, Pencil, Undo2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NameDialog } from '@/features/scan-intake/components/NameDialog'
import { OrganizeFolderTree } from '@/features/scan-intake/components/OrganizeFolderTree'
import { PromoteModal } from '@/features/scan-intake/components/PromoteModal'
import { buildInboxPdfKey } from '@/features/scan-intake/lib/inboxPdfFileName'
import { SCAN_DRAFT_WORKSPACE } from '@/features/scan-intake/lib/constants'
import {
  collectPdfsUnderFolder,
  findFolderNode,
} from '@/features/scan-intake/lib/collectOrganizePdfs'
import {
  buildOrganizeTree,
  hasOrganizeTree,
} from '@/features/scan-intake/lib/organizeFolderTree'
import {
  collectAllFolderPaths,
  collectPromotePdfKeys,
  isAllFoldersSelected,
  isAllPdfsSelected,
  isPdfChecked,
  selectAllFolders,
  selectAllPdfs,
  toggleFolderSelection,
  togglePdfSelection,
  type OrganizeMultiSelection,
} from '@/features/scan-intake/lib/organizeMultiSelection'
import { validateNoMixedOrganizeFolder } from '@/features/scan-intake/lib/validateOrganizeFolderLayout'
import {
  joinFolderPath,
  formatFolderPath,
  sanitizeFolderPath,
} from '@/features/scan-intake/lib/sanitizeFolderPath'
import { sanitizePathSegment } from '@/features/scan-intake/lib/sanitizePathSegment'
import type { ScanIntakeSessionDetail } from '@/features/scan-intake/types'
import type { useScanIntakeMutations } from '@/features/scan-intake/queries'
import { cn } from '@/lib/utils/cn'

interface OrganizePanelProps {
  session: ScanIntakeSessionDetail
  mutations: ReturnType<typeof useScanIntakeMutations>
  extraFolders: Array<string>
  onAddFolder: (path: string) => void
  onRenameFolder: (oldPath: string, newPath: string) => void
  onCommitted: () => void
}

export function OrganizePanel({
  session,
  mutations,
  extraFolders,
  onAddFolder,
  onRenameFolder,
  onCommitted,
}: OrganizePanelProps) {
  const { t } = useTranslation('scan-intake')
  const [folderDialog, setFolderDialog] = useState<{
    open: boolean
    parentPath?: string
  }>({ open: false })
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean
    folderPath: string
    currentName: string
  }>({ open: false, folderPath: '', currentName: '' })
  const [renamePdfDialog, setRenamePdfDialog] = useState<{
    open: boolean
    pdfKey: string
    currentName: string
  }>({ open: false, pdfKey: '', currentName: '' })
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [selection, setSelection] = useState<OrganizeMultiSelection>(null)
  const [dragPdfKey, setDragPdfKey] = useState<string | null>(null)

  const inboxPdfs = useMemo(
    () =>
      session.inbox.filter(
        (doc) => doc.pdfKey && doc.pageCount > 0,
      ),
    [session.inbox],
  )

  const folderPdfs = useMemo(
    () => session.folders.flatMap((folder) => folder.pdfs),
    [session.folders],
  )

  const tree = useMemo(
    () => buildOrganizeTree(session.folders, extraFolders),
    [session.folders, extraFolders],
  )

  const treeHasFolders = hasOrganizeTree(tree)
  const allFolderPaths = useMemo(() => collectAllFolderPaths(tree), [tree])
  const inboxPdfKeys = useMemo(
    () => inboxPdfs.map((doc) => doc.pdfKey!),
    [inboxPdfs],
  )

  const promotePdfKeys = useMemo(
    () => collectPromotePdfKeys(selection, tree),
    [selection, tree],
  )

  const promotePdfLabels = useMemo(() => {
    return promotePdfKeys.map((key) => {
      const inboxDoc = inboxPdfs.find((d) => d.pdfKey === key)
      if (inboxDoc) return inboxDoc.displayName
      const organized = folderPdfs.find((p) => p.key === key)
      if (organized) {
        return organized.name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
      }
      return key.split('/').pop()?.replace(/\.pdf$/i, '').replace(/_/g, ' ') ?? key
    })
  }, [promotePdfKeys, inboxPdfs, folderPdfs])

  const selectedFolderPaths = useMemo(() => {
    if (selection?.type !== 'folder') return []
    return [...selection.paths].sort()
  }, [selection])

  const selectedOrganizeFolder =
    selectedFolderPaths.length === 1 ? selectedFolderPaths[0] : undefined

  const selectedOrganizeFolderLabel = selectedOrganizeFolder
    ? formatFolderPath(
        selectedOrganizeFolder.split('/').pop() ?? selectedOrganizeFolder,
      )
    : undefined

  const canPromote = promotePdfKeys.length > 0
  const isBusy =
    mutations.organizeMoveMutation.isPending ||
    mutations.organizeRenameFolderMutation.isPending ||
    mutations.organizeRenamePdfMutation.isPending ||
    mutations.promoteMutation.isPending

  const allInboxSelected = isAllPdfsSelected(selection, inboxPdfKeys)
  const allFoldersSelected = isAllFoldersSelected(selection, allFolderPaths)

  function handleToggleInboxPdf(key: string) {
    if (selection?.type === 'folder') {
      toast.message(t('organize.mixedSelectionBlocked'))
      return
    }
    setSelection(togglePdfSelection(selection, key))
  }

  function handleToggleFolderPdf(key: string) {
    if (selection?.type === 'folder') {
      toast.message(t('organize.mixedSelectionBlocked'))
      return
    }
    setSelection(togglePdfSelection(selection, key))
  }

  function handleToggleFolder(path: string) {
    if (selection?.type === 'pdf') {
      toast.message(t('organize.mixedSelectionBlocked'))
      return
    }
    setSelection(toggleFolderSelection(selection, path))
  }

  function handleToggleAllInbox() {
    if (selection?.type === 'folder') {
      toast.message(t('organize.mixedSelectionBlocked'))
      return
    }
    if (allInboxSelected) {
      setSelection(null)
      return
    }
    setSelection(selectAllPdfs(inboxPdfKeys))
  }

  function handleToggleAllFolders() {
    if (selection?.type === 'pdf') {
      toast.message(t('organize.mixedSelectionBlocked'))
      return
    }
    if (allFoldersSelected) {
      setSelection(null)
      return
    }
    setSelection(selectAllFolders(allFolderPaths))
  }

  function resolvePdfDisplayName(sourceKey: string): string {
    const inboxDoc = inboxPdfs.find((doc) => doc.pdfKey === sourceKey)
    if (inboxDoc) return inboxDoc.displayName

    const organized = folderPdfs.find((pdf) => pdf.key === sourceKey)
    if (organized) {
      return organized.name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
    }

    const base = sourceKey.split('/').pop() ?? 'untitled'
    const inboxMatch = sourceKey.match(/\/inbox\/([^/]+)\/[^/]+\.pdf$/i)
    if (inboxMatch) {
      return inboxMatch[1].replace(/_/g, ' ')
    }
    return base.replace(/\.pdf$/i, '').replace(/_/g, ' ')
  }

  function getUniqueSlugWithUsed(baseName: string, usedSlugs: Set<string>): string {
    const base = sanitizePathSegment(baseName)
    if (!usedSlugs.has(base)) {
      usedSlugs.add(base)
      return base
    }
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base}_${i}`
      if (!usedSlugs.has(candidate)) {
        usedSlugs.add(candidate)
        return candidate
      }
    }
    const fallback = `${base}_${Date.now()}`
    usedSlugs.add(fallback)
    return fallback
  }

  function uniqueInboxDocSlug(baseName: string): string {
    const used = new Set(inboxPdfs.map((d) => d.docSlug))
    return getUniqueSlugWithUsed(baseName, used)
  }

  async function movePdfToFolder(sourceKey: string, folderPath: string) {
    const targetNode = findFolderNode(tree, folderPath)
    if (targetNode?.children.length) {
      toast.error(
        t('organize.mixedFolder', {
          folder: formatFolderPath(folderPath),
        }),
      )
      return
    }

    const pdfDisplayName = resolvePdfDisplayName(sourceKey)
    const folderSlugPath = sanitizeFolderPath(folderPath)
    const pdfName = `${sanitizePathSegment(pdfDisplayName)}.pdf`
    const destKey = `scan-draft/${SCAN_DRAFT_WORKSPACE}/${session.sessionId}/${folderSlugPath}/${pdfName}`

    if (sourceKey === destKey) return

    try {
      await mutations.organizeMoveMutation.mutateAsync({
        sourceKey,
        destKey,
      })
      toast.success(t('organize.moved'))
      setSelection(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('organize.moveFailed'))
    }
  }

  async function movePdfToInbox(sourceKey: string) {
    const displayName = resolvePdfDisplayName(sourceKey)
    const docSlug = uniqueInboxDocSlug(displayName)
    const destKey = buildInboxPdfKey(
      SCAN_DRAFT_WORKSPACE,
      session.sessionId,
      docSlug,
      displayName,
    )

    if (sourceKey === destKey) return

    try {
      await mutations.organizeMoveMutation.mutateAsync({
        sourceKey,
        destKey,
      })
      toast.success(t('organize.movedToInbox'))
      setSelection(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('organize.moveFailed'))
    }
  }

  async function handleMoveSelectionToInbox() {
    if (selection?.type !== 'pdf') return
    const keysToMove = Array.from(selection.keys).filter((key) => !inboxPdfKeys.includes(key))
    if (keysToMove.length === 0) return

    const usedSlugs = new Set(inboxPdfs.map((d) => d.docSlug))

    try {
      for (const sourceKey of keysToMove) {
        const displayName = resolvePdfDisplayName(sourceKey)
        const docSlug = getUniqueSlugWithUsed(displayName, usedSlugs)
        const destKey = buildInboxPdfKey(
          SCAN_DRAFT_WORKSPACE,
          session.sessionId,
          docSlug,
          displayName,
        )
        if (sourceKey !== destKey) {
          await mutations.organizeMoveMutation.mutateAsync({ sourceKey, destKey })
        }
      }
      toast.success(t('organize.movedToInboxBatch', { count: keysToMove.length }))
      setSelection(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('organize.moveFailed'))
    }
  }

  async function handleRenamePdf(pdfKey: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return

    try {
      const result = await mutations.organizeRenamePdfMutation.mutateAsync({
        pdfKey,
        newName: trimmed,
      })
      if (selection?.type === 'pdf' && selection.keys.has(pdfKey)) {
        const keys = new Set(selection.keys)
        keys.delete(pdfKey)
        keys.add(result.pdfKey)
        setSelection(keys.size > 0 ? { type: 'pdf', keys } : null)
      }
      toast.success(t('organize.pdfRenamed'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('organize.renamePdfFailed'))
    }
  }

  async function handleRenameFolder(folderPath: string, newName: string) {
    const newPath = joinFolderPath(
      folderPath.includes('/')
        ? folderPath.slice(0, folderPath.lastIndexOf('/'))
        : undefined,
      newName,
    )

    if (newPath === folderPath) return

    const node = findFolderNode(tree, folderPath)
    const hasServerPdfs = (node?.pdfs.length ?? 0) > 0 ||
      session.folders.some(
        (f) =>
          f.folderPath === folderPath ||
          f.folderPath.startsWith(`${folderPath}/`),
      )

    try {
      if (hasServerPdfs) {
        const result = await mutations.organizeRenameFolderMutation.mutateAsync({
          folderPath,
          newName,
        })
        onRenameFolder(folderPath, result.folderPath)
        if (selection?.type === 'folder' && selection.paths.has(folderPath)) {
          const paths = new Set(selection.paths)
          paths.delete(folderPath)
          paths.add(result.folderPath)
          setSelection(paths.size > 0 ? { type: 'folder', paths } : null)
        }
      } else {
        onRenameFolder(folderPath, newPath)
        if (selection?.type === 'folder' && selection.paths.has(folderPath)) {
          const paths = new Set(selection.paths)
          paths.delete(folderPath)
          paths.add(newPath)
          setSelection(paths.size > 0 ? { type: 'folder', paths } : null)
        }
      }
      toast.success(t('organize.renamed'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('organize.renameFailed'))
    }
  }

  function openCreateFolder(parentPath?: string) {
    setFolderDialog({ open: true, parentPath })
  }

  function openPromoteModal() {
    if (selection?.type === 'folder') {
      const emptyFolders = selectedFolderPaths.filter(
        (path) => collectPdfsUnderFolder(tree, path).length === 0,
      )
      if (emptyFolders.length > 0 && promotePdfKeys.length === 0) {
        toast.message(t('organize.folderEmptyPromote'))
        return
      }
    }
    if (!canPromote) {
      toast.message(t('organize.selectHint'))
      return
    }

    const layoutCheck = validateNoMixedOrganizeFolder(tree)
    if (layoutCheck !== true) {
      toast.error(
        t('organize.mixedFolder', {
          folder: formatFolderPath(layoutCheck.folderPath),
        }),
      )
      return
    }

    setPromoteOpen(true)
  }

  function promoteButtonLabel(): string {
    if (promotePdfKeys.length === 0) {
      return t('commit.button')
    }
    if (selection?.type === 'folder') {
      if (selectedFolderPaths.length === 1) {
        return t('commit.buttonFolder', { count: promotePdfKeys.length })
      }
      return t('commit.buttonFolders', {
        count: promotePdfKeys.length,
        folderCount: selectedFolderPaths.length,
      })
    }
    return t('commit.buttonSelected', { count: promotePdfKeys.length })
  }

  function handleCommitted() {
    setSelection(null)
    onCommitted()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selection?.type === 'pdf' && Array.from(selection.keys).some(k => !inboxPdfKeys.includes(k)) ? (
          <Button
            variant="secondary"
            disabled={isBusy}
            onClick={() => void handleMoveSelectionToInbox()}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            {t('organize.moveSelectedToInbox')}
          </Button>
        ) : null}
        <Button
          disabled={isBusy}
          onClick={openPromoteModal}
        >
          <Upload className="mr-2 h-4 w-4" />
          {promoteButtonLabel()}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className={cn(
            'rounded-lg border bg-card p-4',
            dragPdfKey && 'border-dashed border-muted-foreground/40',
          )}
          onDragOver={(e) => {
            if (!dragPdfKey || isBusy) return
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (!dragPdfKey || isBusy) return
            void movePdfToInbox(dragPdfKey)
            setDragPdfKey(null)
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">{t('organize.inboxTitle')}</h2>
            {inboxPdfs.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={isBusy || selection?.type === 'folder'}
                onClick={handleToggleAllInbox}
              >
                {allInboxSelected
                  ? t('organize.deselectAll')
                  : t('organize.selectAll')}
              </Button>
            ) : null}
          </div>
          {inboxPdfs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('organize.inboxEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {inboxPdfs.map((doc) => {
                const isSelected = isPdfChecked(selection, doc.pdfKey!)
                const checkboxDisabled = isBusy || selection?.type === 'folder'
                return (
                  <li
                    key={doc.docSlug}
                    draggable={!isBusy}
                    onDragStart={() => setDragPdfKey(doc.pdfKey!)}
                    onDragEnd={() => setDragPdfKey(null)}
                    className={cn(
                      'group flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                      'cursor-grab active:cursor-grabbing',
                      dragPdfKey === doc.pdfKey && 'opacity-50',
                      isSelected && 'border-primary bg-primary/5 font-medium',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={checkboxDisabled}
                      onCheckedChange={() => handleToggleInboxPdf(doc.pdfKey!)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={doc.displayName}
                    />
                    <span className="min-w-0 flex-1">
                      {doc.displayName}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t('pages.count', { count: doc.pageCount })}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                      disabled={isBusy}
                      onClick={() =>
                        setRenamePdfDialog({
                          open: true,
                          pdfKey: doc.pdfKey!,
                          currentName: doc.displayName,
                        })
                      }
                      title={t('organize.renamePdfTitle')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t('organize.dragHint')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('organize.inboxDropHint')}
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">{t('organize.foldersTitle')}</h2>
            <div className="flex items-center gap-1">
              {treeHasFolders ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={isBusy || selection?.type === 'pdf'}
                  onClick={handleToggleAllFolders}
                >
                  {allFoldersSelected
                    ? t('organize.deselectAll')
                    : t('organize.selectAll')}
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => openCreateFolder()}
                title={t('organize.createFolderTitle')}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!treeHasFolders ? (
            <p className="text-sm text-muted-foreground">{t('organize.foldersEmpty')}</p>
          ) : (
            <OrganizeFolderTree
              nodes={tree}
              selection={selection}
              onToggleFolder={handleToggleFolder}
              onTogglePdf={handleToggleFolderPdf}
              dragPdfKey={dragPdfKey}
              onDragPdfStart={setDragPdfKey}
              onDragPdfEnd={() => setDragPdfKey(null)}
              onDropPdf={(folderPath) => {
                if (!dragPdfKey) return
                void movePdfToFolder(dragPdfKey, folderPath)
                setDragPdfKey(null)
              }}
              onAddSubfolder={openCreateFolder}
              onRenameFolder={(folderPath, currentName) =>
                setRenameDialog({ open: true, folderPath, currentName })
              }
              onRenamePdf={(pdfKey, currentName) =>
                setRenamePdfDialog({ open: true, pdfKey, currentName })
              }
              onMoveToInbox={(pdfKey) => void movePdfToInbox(pdfKey)}
              disabled={isBusy}
            />
          )}

          <p className="mt-3 text-xs text-muted-foreground">{t('organize.treeHint')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('organize.multiSelectHint')}</p>

          {isBusy ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('organize.moving')}
            </div>
          ) : null}
        </section>
      </div>

      <NameDialog
        open={folderDialog.open}
        onOpenChange={(open) => setFolderDialog((prev) => ({ ...prev, open }))}
        title={
          folderDialog.parentPath
            ? t('organize.createSubfolderTitle')
            : t('organize.createFolderTitle')
        }
        label={t('organize.folderNameLabel')}
        onSubmit={async (name) => {
          if (folderDialog.parentPath) {
            const parentNode = findFolderNode(tree, folderDialog.parentPath)
            if (parentNode?.pdfs.length) {
              toast.error(
                t('organize.mixedFolder', {
                  folder: formatFolderPath(folderDialog.parentPath),
                }),
              )
              return
            }
          }

          const path = joinFolderPath(folderDialog.parentPath, name)
          onAddFolder(path)
          setFolderDialog({ open: false })
        }}
        isSubmitting={false}
      />

      <NameDialog
        open={renameDialog.open}
        onOpenChange={(open) => setRenameDialog((prev) => ({ ...prev, open }))}
        title={t('organize.renameFolderTitle')}
        label={t('organize.folderNameLabel')}
        defaultValue={renameDialog.currentName}
        onSubmit={async (name) => {
          await handleRenameFolder(renameDialog.folderPath, name)
          setRenameDialog((prev) => ({ ...prev, open: false }))
        }}
        isSubmitting={mutations.organizeRenameFolderMutation.isPending}
      />

      <NameDialog
        open={renamePdfDialog.open}
        onOpenChange={(open) => setRenamePdfDialog((prev) => ({ ...prev, open }))}
        title={t('organize.renamePdfTitle')}
        label={t('organize.pdfNameLabel')}
        defaultValue={renamePdfDialog.currentName}
        onSubmit={async (name) => {
          await handleRenamePdf(renamePdfDialog.pdfKey, name)
          setRenamePdfDialog((prev) => ({ ...prev, open: false }))
        }}
        isSubmitting={mutations.organizeRenamePdfMutation.isPending}
      />

      <PromoteModal
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        pdfKeys={promotePdfKeys}
        pdfLabels={promotePdfLabels}
        organizeFolderPath={selectedOrganizeFolder}
        organizeFolderLabel={selectedOrganizeFolderLabel}
        selectedFolderCount={selectedFolderPaths.length}
        mutations={mutations}
        onCommitted={handleCommitted}
      />
    </div>
  )
}
