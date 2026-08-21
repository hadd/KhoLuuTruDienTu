import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NameDialog } from '@/features/scan-intake/components/NameDialog'
import { OrganizePanel } from '@/features/scan-intake/components/OrganizePanel'
import { PageGrid } from '@/features/scan-intake/components/PageGrid'
import { ScanAgentGuard } from '@/features/scan-intake/components/ScanAgentGuard'
import { DigitizationBackNav } from '@/features/digitization/components/DigitizationBackNav'
import { DigitizationSubPageShell } from '@/features/digitization/components/DigitizationSubPageShell'
import { isAgentV2, deleteScanSession } from '@/features/scan-intake/api/scanIntakeClient'
import {
  DEFAULT_DOC_NAME,
  DEFAULT_DOC_SLUG,
  SCAN_SESSION_STORAGE_KEY,
} from '@/features/scan-intake/lib/constants'
import { sanitizePathSegment } from '@/features/scan-intake/lib/sanitizePathSegment'
import {
  useScanAgentHealth,
  useScanIntakeMutations,
  useScanSession,
} from '@/features/scan-intake/queries'
import type { ScanIntakeInboxDoc, ScanIntakePhase } from '@/features/scan-intake/types'
import { cn } from '@/lib/utils/cn'
import { createRandomUuid } from '@/lib/utils/id'

function loadOrCreateSessionId(): string {
  const stored = sessionStorage.getItem(SCAN_SESSION_STORAGE_KEY)
  if (stored) return stored
  const id = createRandomUuid()
  sessionStorage.setItem(SCAN_SESSION_STORAGE_KEY, id)
  return id
}

export function ScanIntakePage() {
  const { t } = useTranslation('scan-intake')
  const { data: health } = useScanAgentHealth()

  const [sessionId, setSessionId] = useState(loadOrCreateSessionId)
  const [phase, setPhase] = useState<ScanIntakePhase>('scan')
  const [selectedDocSlug, setSelectedDocSlug] = useState<string | undefined>(
    DEFAULT_DOC_SLUG,
  )
  const [localDocs, setLocalDocs] = useState<
    Array<{ docSlug: string; displayName: string }>
  >([{ docSlug: DEFAULT_DOC_SLUG, displayName: DEFAULT_DOC_NAME }])
  const [extraFolders, setExtraFolders] = useState<Array<string>>([])
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [deleteDocDialog, setDeleteDocDialog] = useState<{
    open: boolean
    docSlug: string
    displayName: string
  }>({ open: false, docSlug: '', displayName: '' })
  const [renameDocDialog, setRenameDocDialog] = useState<{
    open: boolean
    docSlug: string
    currentName: string
    pdfKey: string | null
  }>({ open: false, docSlug: '', currentName: '', pdfKey: null })

  const { data: session, isPending: sessionLoading } = useScanSession(sessionId)
  const mutations = useScanIntakeMutations(sessionId)

  useEffect(() => {
    sessionStorage.setItem(SCAN_SESSION_STORAGE_KEY, sessionId)
  }, [sessionId])

  const mergedInbox = useMemo(() => {
    const fromMinio = session?.inbox ?? []
    const localNameBySlug = new Map(
      localDocs.map((doc) => [doc.docSlug, doc.displayName]),
    )
    const map = new Map<string, ScanIntakeInboxDoc>()
    for (const doc of fromMinio) {
      map.set(doc.docSlug, {
        ...doc,
        displayName: localNameBySlug.get(doc.docSlug) ?? doc.displayName,
      })
    }
    for (const local of localDocs) {
      if (!map.has(local.docSlug)) {
        map.set(local.docSlug, {
          docSlug: local.docSlug,
          displayName: local.displayName,
          pages: [],
          pdfKey: null,
          pageCount: 0,
        })
      }
    }
    return [...map.values()].sort((a, b) =>
      a.docSlug.localeCompare(b.docSlug),
    )
  }, [session?.inbox, localDocs])

  useEffect(() => {
    if (mergedInbox.length === 0) {
      setSelectedDocSlug(undefined)
      return
    }
    if (!selectedDocSlug || !mergedInbox.some((d) => d.docSlug === selectedDocSlug)) {
      setSelectedDocSlug(mergedInbox[0]!.docSlug)
    }
  }, [mergedInbox, selectedDocSlug])

  const selectedDocument = mergedInbox.find((d) => d.docSlug === selectedDocSlug)
  const agentOk = isAgentV2(health)

  function upsertLocalDocDisplayName(docSlug: string, displayName: string) {
    setLocalDocs((prev) => {
      const existing = prev.find((doc) => doc.docSlug === docSlug)
      if (existing) {
        return prev.map((doc) =>
          doc.docSlug === docSlug ? { ...doc, displayName } : doc,
        )
      }
      return [...prev, { docSlug, displayName }]
    })
  }

  function openRenameDocDialog(doc: ScanIntakeInboxDoc) {
    setRenameDocDialog({
      open: true,
      docSlug: doc.docSlug,
      currentName: doc.displayName,
      pdfKey: doc.pdfKey,
    })
  }

  async function handleRenameDocument(newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return

    const { docSlug, currentName, pdfKey } = renameDocDialog
    if (trimmed === currentName) return

    if (pdfKey) {
      try {
        await mutations.organizeRenamePdfMutation.mutateAsync({
          pdfKey,
          newName: trimmed,
        })
        upsertLocalDocDisplayName(docSlug, trimmed)
        toast.success(t('organize.pdfRenamed'))
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t('organize.renamePdfFailed'),
        )
        return
      }
    } else {
      upsertLocalDocDisplayName(docSlug, trimmed)
      toast.success(t('documents.renamed'))
    }

    setRenameDocDialog((prev) => ({ ...prev, open: false }))
  }

  function handleRenameExtraFolder(oldPath: string, newPath: string) {
    setExtraFolders((prev) =>
      prev.map((path) => {
        if (path === oldPath) return newPath
        if (path.startsWith(`${oldPath}/`)) {
          return `${newPath}${path.slice(oldPath.length)}`
        }
        return path
      }),
    )
  }

  function handleResetSession() {
    const oldId = sessionId
    const id = createRandomUuid()
    setSessionId(id)
    setLocalDocs([{ docSlug: DEFAULT_DOC_SLUG, displayName: DEFAULT_DOC_NAME }])
    setSelectedDocSlug(DEFAULT_DOC_SLUG)
    setExtraFolders([])
    setPhase('scan')
    if (oldId) {
      void deleteScanSession(oldId).catch(() => {
        /* session may not exist on MinIO yet */
      })
    }
    toast.success(t('session.reset'))
  }

  return (
    <DigitizationSubPageShell active="scan">
      <div className="flex h-0 min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <DigitizationBackNav
            currentLabel={t('page.title')}
            description={`${t('page.description')}${health?.version ? ` · Agent v${health.version}` : ''}`}
          />
          {health && !agentOk ? (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              {t('agent.needV2')}
            </p>
          ) : null}
        </div>

        <ScanAgentGuard>
          <div className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sessionLoading && !session ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('session.loadingDetail')}
          </div>
        ) : (
          // Tìm đoạn <Tabs> trong ScanIntakePage.tsx và thay bằng đoạn này:
<Tabs
  value={phase}
  onValueChange={(v) => {
    if (v === 'scan' || v === 'organize') {
      setPhase(v)
    }
  }}
  className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
>
  <TabsList className="shrink-0 self-start">
    <TabsTrigger value="scan">{t('phases.scan')}</TabsTrigger>
    <TabsTrigger value="organize">{t('phases.organize')}</TabsTrigger>
  </TabsList>

  {/* KHẮC PHỤC Ở ĐÂY: Thêm data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full h-0 min-h-0 */}
  <TabsContent
    value="scan"
    className="mt-2 h-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
  >
    <div className="grid h-full min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[200px_1fr]">
      {/* Danh sách tài liệu */}
      <section className="flex h-full min-h-0 flex-col rounded-lg border bg-card p-3 overflow-hidden">
        <div className="mb-2 shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('documents.title')}</h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setDocumentDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
          {mergedInbox.map((doc) => (
            <li key={doc.docSlug} className="group flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted',
                  selectedDocSlug === doc.docSlug && 'bg-muted font-medium',
                )}
                onClick={() => setSelectedDocSlug(doc.docSlug)}
              >
                <span className="truncate">{doc.displayName}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {doc.pageCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Vùng PageGrid */}
      <section className="flex h-full min-h-0 flex-col rounded-lg border bg-card p-3 overflow-hidden">
        {selectedDocument ? (
          <PageGrid
            document={selectedDocument}
            mutations={mutations}
            scanDisabled={!agentOk}
            onRename={() => openRenameDocDialog(selectedDocument)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('pages.selectDocument')}
          </p>
        )}
      </section>
    </div>
  </TabsContent>

  <TabsContent
    value="organize"
    className="mt-2 h-0 min-h-0 flex-1 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col"
  >
    {session ? (
      <OrganizePanel
        session={session}
        mutations={mutations}
        extraFolders={extraFolders}
        onAddFolder={(path) =>
          setExtraFolders((prev) =>
            prev.includes(path) ? prev : [...prev, path],
          )
        }
        onRenameFolder={handleRenameExtraFolder}
        onCommitted={() => {}}
      />
    ) : null}
  </TabsContent>
</Tabs>
        )}
          </div>
        </ScanAgentGuard>

        <NameDialog
          open={documentDialogOpen}
          onOpenChange={setDocumentDialogOpen}
          title={t('documents.createTitle')}
          label={t('documents.nameLabel')}
          onSubmit={async (name) => {
            const docSlug = sanitizePathSegment(name)
            setLocalDocs((prev) => {
              if (prev.some((d) => d.docSlug === docSlug)) return prev
              return [...prev, { docSlug, displayName: name }]
            })
            setSelectedDocSlug(docSlug)
            setDocumentDialogOpen(false)
          }}
          isSubmitting={false}
        />

        <NameDialog
          open={renameDocDialog.open}
          onOpenChange={(open) => setRenameDocDialog((prev) => ({ ...prev, open }))}
          title={
            renameDocDialog.pdfKey
              ? t('organize.renamePdfTitle')
              : t('documents.renameTitle')
          }
          label={
            renameDocDialog.pdfKey
              ? t('organize.pdfNameLabel')
              : t('documents.nameLabel')
          }
          defaultValue={renameDocDialog.currentName}
          onSubmit={handleRenameDocument}
          isSubmitting={mutations.organizeRenamePdfMutation.isPending}
        />
        <AlertDialog
          open={deleteDocDialog.open}
          onOpenChange={(open) =>
            setDeleteDocDialog((prev) => ({ ...prev, open }))
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('documents.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('documents.deleteConfirm', { name: deleteDocDialog.displayName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('documents.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async (e) => {
                  e.preventDefault()
                  try {
                    await mutations.deleteDocumentMutation.mutateAsync(
                      deleteDocDialog.docSlug,
                    )
                    setLocalDocs((prev) =>
                      prev.filter((d) => d.docSlug !== deleteDocDialog.docSlug),
                    )
                    if (selectedDocSlug === deleteDocDialog.docSlug) {
                      setSelectedDocSlug(undefined)
                    }
                    toast.success(t('documents.deleted'))
                    setDeleteDocDialog((prev) => ({ ...prev, open: false }))
                  } catch {
                    toast.error(t('documents.deleteFailed'))
                  }
                }}
              >
                {mutations.deleteDocumentMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t('documents.deleteAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DigitizationSubPageShell>
  )
}
