import { Loader2, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NameDialog } from '@/features/scan-intake/components/NameDialog'
import { OrganizePanel } from '@/features/scan-intake/components/OrganizePanel'
import { PageGrid } from '@/features/scan-intake/components/PageGrid'
import { ScanAgentGuard } from '@/features/scan-intake/components/ScanAgentGuard'
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

  const { data: session, isPending: sessionLoading } = useScanSession(sessionId)
  const mutations = useScanIntakeMutations(sessionId)

  useEffect(() => {
    sessionStorage.setItem(SCAN_SESSION_STORAGE_KEY, sessionId)
  }, [sessionId])

  const mergedInbox = useMemo(() => {
    const fromMinio = session?.inbox ?? []
    const map = new Map<string, ScanIntakeInboxDoc>()
    for (const doc of fromMinio) map.set(doc.docSlug, doc)
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
    <ScanAgentGuard>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('page.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('page.description')}
              {health?.version ? ` · Agent v${health.version}` : ''}
            </p>
            {health && !agentOk ? (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                {t('agent.needV2')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleResetSession}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('session.reset')}
            </Button>
          </div>
        </div>

        {sessionLoading && !session ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('session.loadingDetail')}
          </div>
        ) : (
          <Tabs
            value={phase}
            onValueChange={(v) => {
              if (v === 'scan' || v === 'organize') {
                setPhase(v)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="scan">{t('phases.scan')}</TabsTrigger>
              <TabsTrigger value="organize">{t('phases.organize')}</TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <section className="rounded-lg border bg-card p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium">{t('documents.title')}</h2>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setDocumentDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {mergedInbox.map((doc) => (
                      <li key={doc.docSlug}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                            selectedDocSlug === doc.docSlug &&
                              'bg-muted font-medium',
                          )}
                          onClick={() => setSelectedDocSlug(doc.docSlug)}
                        >
                          <span className="truncate">{doc.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {doc.pageCount}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-lg border bg-card p-4">
                  {selectedDocument ? (
                    <PageGrid
                      document={selectedDocument}
                      mutations={mutations}
                      scanDisabled={!agentOk}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('pages.selectDocument')}
                    </p>
                  )}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="organize" className="mt-4">
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
                  onCommitted={handleResetSession}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        )}

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
      </div>
    </ScanAgentGuard>
  )
}
