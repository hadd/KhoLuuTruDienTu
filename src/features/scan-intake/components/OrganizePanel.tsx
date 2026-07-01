import { FolderPlus, Loader2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { NameDialog } from '@/features/scan-intake/components/NameDialog'
import {
  OrganizeFolderTree,
  type OrganizeSelection,
} from '@/features/scan-intake/components/OrganizeFolderTree'
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
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [selection, setSelection] = useState<OrganizeSelection>(null)
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

  const promotePdfKeys = useMemo(() => {
    if (!selection) return []
    if (selection.type === 'pdf') return [selection.key]
    return collectPdfsUnderFolder(tree, selection.path)
  }, [selection, tree])

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

  const selectedOrganizeFolder =
    selection?.type === 'folder' ? selection.path : undefined

  const selectedOrganizeFolderLabel = selectedOrganizeFolder
    ? formatFolderPath(selectedOrganizeFolder.split('/').pop() ?? selectedOrganizeFolder)
    : undefined

  const canPromote = promotePdfKeys.length > 0
  const isBusy =
    mutations.organizeMoveMutation.isPending ||
    mutations.organizeRenameFolderMutation.isPending ||
    mutations.promoteMutation.isPending

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

  function uniqueInboxDocSlug(baseName: string): string {
    const base = sanitizePathSegment(baseName)
    const used = new Set(inboxPdfs.map((d) => d.docSlug))
    if (!used.has(base)) return base
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}_${i}`
      if (!used.has(candidate)) return candidate
    }
    return `${base}_${Date.now()}`
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
        if (selection?.type === 'folder' && selection.path === folderPath) {
          setSelection({ type: 'folder', path: result.folderPath })
        }
      } else {
        onRenameFolder(folderPath, newPath)
        if (selection?.type === 'folder' && selection.path === folderPath) {
          setSelection({ type: 'folder', path: newPath })
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
    if (selection?.type === 'folder' && promotePdfKeys.length === 0) {
      toast.message(t('organize.folderEmptyPromote'))
      return
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          disabled={isBusy}
          onClick={openPromoteModal}
        >
          <Upload className="mr-2 h-4 w-4" />
          {selectedOrganizeFolder
            ? t('commit.buttonFolder', { count: promotePdfKeys.length })
            : t('commit.button')}
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
          <h2 className="mb-3 font-medium">{t('organize.inboxTitle')}</h2>
          {inboxPdfs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('organize.inboxEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {inboxPdfs.map((doc) => {
                const isSelected =
                  selection?.type === 'pdf' && selection.key === doc.pdfKey
                return (
                  <li
                    key={doc.docSlug}
                    draggable={!isBusy}
                    onDragStart={() => setDragPdfKey(doc.pdfKey!)}
                    onDragEnd={() => setDragPdfKey(null)}
                    onClick={() =>
                      setSelection({ type: 'pdf', key: doc.pdfKey! })
                    }
                    className={cn(
                      'cursor-pointer rounded-md border px-3 py-2 text-sm',
                      'cursor-grab active:cursor-grabbing',
                      dragPdfKey === doc.pdfKey && 'opacity-50',
                      isSelected && 'border-primary bg-primary/5 font-medium',
                    )}
                  >
                    {doc.displayName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('pages.count', { count: doc.pageCount })}
                    </span>
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

          {!treeHasFolders ? (
            <p className="text-sm text-muted-foreground">{t('organize.foldersEmpty')}</p>
          ) : (
            <OrganizeFolderTree
              nodes={tree}
              selection={selection}
              onSelectionChange={setSelection}
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
              disabled={isBusy}
            />
          )}

          <p className="mt-3 text-xs text-muted-foreground">{t('organize.treeHint')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('organize.selectHint')}</p>

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

      <PromoteModal
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        pdfKeys={promotePdfKeys}
        pdfLabels={promotePdfLabels}
        organizeFolderPath={selectedOrganizeFolder}
        organizeFolderLabel={selectedOrganizeFolderLabel}
        mutations={mutations}
        onCommitted={onCommitted}
      />
    </div>
  )
}
