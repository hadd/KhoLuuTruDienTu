import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpen, FileText, FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FlipbookViewer } from '@/components/common/FlipbookViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArchiveBorrowReaderPanel } from '@/features/archive-borrow/components/ArchiveBorrowReaderPanel'
import {
  archiveBorrowRequestQueryOptions,
  archiveBorrowViewModelQueryOptions,
} from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowViewerDossierT,
  ArchiveBorrowViewerFileT,
} from '@/features/archive-borrow/types'
import { warehouseSubTabsTriggerClassName } from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'
import { env } from '@/lib/utils/env'
import { translateError } from '@/lib/utils/translate-error'

export type ArchiveBorrowViewerFrom = 'library' | 'warehouse'

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function buildDipContentApiUrl(borrowId: string, fileId: string) {
  return `${env.API_URL}/api/v1/archive-borrow-requests/${borrowId}/dip/files/${fileId}/content`
}

function DetailField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}

const detailFieldsGridClassName =
  'grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3'

function useViewerSearch() {
  const search = useRouterState({ select: (s) => s.location.search })
  const from: ArchiveBorrowViewerFrom =
    search &&
    typeof search === 'object' &&
    'from' in search &&
    search.from === 'library'
      ? 'library'
      : 'warehouse'

  const fileId =
    search &&
    typeof search === 'object' &&
    'fileId' in search &&
    typeof search.fileId === 'string'
      ? search.fileId
      : null

  const page =
    search &&
    typeof search === 'object' &&
    'page' in search &&
    typeof search.page === 'number' &&
    Number.isFinite(search.page)
      ? Math.max(1, Math.floor(search.page))
      : null

  return { from, fileId, page }
}

function BackLink() {
  const { t } = useTranslation('archive-borrow')
  const { from } = useViewerSearch()

  if (from === 'library') {
    return (
      <Button asChild variant="outline">
        <Link to="/app/library" search={{ tab: 'borrow' }}>
          {t('page.back')}
        </Link>
      </Button>
    )
  }

  return (
    <Button asChild variant="outline">
      <Link to="/app/archive-warehouse/" search={{ tab: 'borrow' }}>
        {t('page.back')}
      </Link>
    </Button>
  )
}

export function ArchiveBorrowViewerPage({ borrowId }: { borrowId: string }) {
  const { t } = useTranslation('archive-borrow')
  const { fileId: deepLinkFileId, page: deepLinkPage } = useViewerSearch()
  const requestQuery = useQuery(archiveBorrowRequestQueryOptions(borrowId))
  const [now, setNow] = useState(() => Date.now())
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    deepLinkFileId,
  )
  const [detailTab, setDetailTab] = useState<'dossier' | 'documents'>('documents')
  const [appliedDeepLink, setAppliedDeepLink] = useState(false)

  const data = requestQuery.data
  const approvedUntilMs = data?.approvedUntil
    ? new Date(data.approvedUntil).getTime()
    : null
  const timeExpired = approvedUntilMs != null && now >= approvedUntilMs
  const expired =
    data?.status === 'EXPIRED' || timeExpired || data?.status !== 'ACTIVE'
  const canLoadViewModel =
    Boolean(borrowId) &&
    data?.status === 'ACTIVE' &&
    data.dipPackage?.status === 'READY' &&
    !expired

  const viewModelQuery = useQuery({
    ...archiveBorrowViewModelQueryOptions(borrowId),
    enabled: canLoadViewModel,
  })

  useEffect(() => {
    if (!approvedUntilMs || expired) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [approvedUntilMs, expired])

  const dossiers = viewModelQuery.data?.dossiers ?? []

  useEffect(() => {
    if (appliedDeepLink || dossiers.length === 0 || !deepLinkFileId) return
    for (const dossier of dossiers) {
      if (dossier.files.some((file) => file.fileId === deepLinkFileId)) {
        setSelectedDossierId(dossier.id)
        setSelectedFileId(deepLinkFileId)
        setAppliedDeepLink(true)
        return
      }
    }
    setAppliedDeepLink(true)
  }, [appliedDeepLink, deepLinkFileId, dossiers])

  useEffect(() => {
    if (selectedDossierId || dossiers.length === 0) return
    setSelectedDossierId(dossiers[0].id)
  }, [dossiers, selectedDossierId])

  const selectedDossier: ArchiveBorrowViewerDossierT | null = useMemo(() => {
    if (!selectedDossierId) return dossiers[0] ?? null
    return dossiers.find((d) => d.id === selectedDossierId) ?? dossiers[0] ?? null
  }, [dossiers, selectedDossierId])

  const files = selectedDossier?.files ?? []
  const singleFileMode = files.length <= 1

  useEffect(() => {
    if (!selectedDossier) return
    const stillValid = files.some((f) => f.fileId === selectedFileId)
    if (!stillValid) {
      setSelectedFileId(files[0]?.fileId ?? null)
    }
  }, [files, selectedDossier, selectedFileId])

  useEffect(() => {
    if (singleFileMode) setDetailTab('documents')
  }, [singleFileMode])

  const selectedFile: ArchiveBorrowViewerFileT | null = useMemo(() => {
    if (!selectedFileId) return files[0] ?? null
    return files.find((f) => f.fileId === selectedFileId) ?? files[0] ?? null
  }, [files, selectedFileId])

  const pdfUrl =
    selectedFile && canLoadViewModel
      ? buildDipContentApiUrl(borrowId, selectedFile.fileId)
      : null

  const remainingLabel = useMemo(() => {
    if (!approvedUntilMs) return '—'
    return formatCountdown(approvedUntilMs - now)
  }, [approvedUntilMs, now])

  const showDossierNav = dossiers.length > 1
  const initialPage =
    selectedFile && deepLinkFileId === selectedFile.fileId ? deepLinkPage : null

  if (requestQuery.isLoading) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('page.viewerTitle')}…
      </p>
    )
  }

  if (requestQuery.error || !data) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {translateError(requestQuery.error) || t('errors.loadFailed')}
        </p>
        <BackLink />
      </div>
    )
  }

  if (data.dipPackage?.status === 'PENDING') {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">
          {t('page.viewerPreparing')}
        </p>
        <BackLink />
      </div>
    )
  }

  if (data.dipPackage?.status === 'FAILED') {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {data.dipPackage.errorMessage || t('page.viewerFailed')}
        </p>
        <BackLink />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('page.viewerTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {expired
              ? t('page.viewerExpired')
              : `${t('page.viewerCountdown')}: ${remainingLabel}`}
          </p>
        </div>
        <BackLink />
      </div>

      {expired ? (
        <div className="flex flex-1 items-center justify-center rounded-md border p-6 text-sm text-muted-foreground">
          {t('page.viewerExpired')}
        </div>
      ) : viewModelQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('page.viewerLoading')}
        </div>
      ) : viewModelQuery.error ? (
        <p className="text-sm text-destructive">
          {translateError(viewModelQuery.error) || t('errors.viewFailed')}
        </p>
      ) : dossiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.noFiles')}</p>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 gap-3 overflow-hidden',
            showDossierNav && 'lg:grid lg:grid-cols-[200px_minmax(0,1fr)]',
          )}
        >
          {showDossierNav ? (
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <p className="shrink-0 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                {t('page.viewerDossiers')}
              </p>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {dossiers.map((dossier) => {
                  const active = dossier.id === selectedDossier?.id
                  return (
                    <li key={dossier.id}>
                      <button
                        type="button"
                        className={cn(
                          'block w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                          active
                            ? 'bg-primary/10 text-foreground'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                        onClick={() => setSelectedDossierId(dossier.id)}
                      >
                        <span className="line-clamp-2">{dossier.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t('page.fileCount', {
                            count: dossier.files.length,
                          })}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>
          ) : null}

          {!selectedDossier ? (
            <p className="text-sm text-muted-foreground">
              {t('page.viewerNoDossier')}
            </p>
          ) : (
            <Tabs
              value={detailTab}
              onValueChange={(value) => {
                if (value === 'dossier' || value === 'documents') {
                  setDetailTab(value)
                }
              }}
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
            >
              <TabsList className="mb-0 flex h-auto w-auto shrink-0 items-end justify-start gap-1 border-0 bg-transparent p-0">
                <TabsTrigger
                  value="dossier"
                  className={warehouseSubTabsTriggerClassName}
                >
                  <FolderOpen className="size-3.5 shrink-0" aria-hidden />
                  {t('page.viewerDossierInfo')}
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className={warehouseSubTabsTriggerClassName}
                >
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  {t('page.viewerDocumentInfo')}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="dossier"
                className="mt-0 min-h-0 min-w-0 overflow-y-auto"
              >
                <Card className="divide-y divide-border p-3">
                  <section className="space-y-2 pb-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {t('page.viewerDossierInfo')}
                    </h3>
                    <dl className={detailFieldsGridClassName}>
                      <DetailField label={t('page.viewerDossierName')}>
                        {selectedDossier.name}
                      </DetailField>
                      <DetailField label={t('page.viewerFond')}>
                        {selectedDossier.fondName ?? '—'}
                      </DetailField>
                      <DetailField label={t('page.viewerDossierType')}>
                        {selectedDossier.dossierTypeName ?? '—'}
                      </DetailField>
                      <DetailField label={t('page.viewerPath')}>
                        <span className="break-all">
                          {selectedDossier.folderPath ?? '—'}
                        </span>
                      </DetailField>
                      <DetailField label={t('page.viewerArchiveYear')}>
                        {selectedDossier.archiveYear ?? '—'}
                      </DetailField>
                      <DetailField label={t('page.viewerArchiveStorageState')}>
                        {selectedDossier.archiveStorageState
                          ? t(
                              `archiveStorageState.${selectedDossier.archiveStorageState}`,
                              {
                                defaultValue:
                                  selectedDossier.archiveStorageState,
                              },
                            )
                          : '—'}
                      </DetailField>
                    </dl>
                  </section>
                </Card>
              </TabsContent>

              <TabsContent
                value="documents"
                className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('page.noFiles')}
                  </p>
                ) : (
                  <div
                    className={cn(
                      'grid min-h-0 flex-1 gap-3 overflow-hidden',
                      !singleFileMode &&
                        'lg:grid-cols-[220px_minmax(0,1fr)]',
                    )}
                  >
                    {!singleFileMode ? (
                      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
                        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                          {files.map((file) => {
                            const active = file.fileId === selectedFile?.fileId
                            return (
                              <li key={file.fileId}>
                                <button
                                  type="button"
                                  className={cn(
                                    'block w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                                    active
                                      ? 'bg-primary/10 text-foreground'
                                      : 'text-muted-foreground hover:bg-muted',
                                  )}
                                  onClick={() => setSelectedFileId(file.fileId)}
                                >
                                  <span className="line-clamp-2">
                                    {file.fileName}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null}
                    <PdfPanel
                      borrowId={borrowId}
                      file={selectedFile}
                      pdfUrl={pdfUrl}
                      expired={expired}
                      initialPage={initialPage}
                      canWrite={!expired}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  )
}

function PdfPanel({
  borrowId,
  file,
  pdfUrl,
  expired,
  initialPage,
  canWrite,
}: {
  borrowId: string
  file: ArchiveBorrowViewerFileT | null
  pdfUrl: string | null
  expired: boolean
  initialPage?: number | null
  canWrite: boolean
}) {
  const { t: tWarehouse } = useTranslation('archive-warehouse')
  const [flipbookOpen, setFlipbookOpen] = useState(false)
  const canOpenFlipbook = Boolean(pdfUrl && !expired)

  useEffect(() => {
    setFlipbookOpen(false)
  }, [file?.fileId])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {!expired && pdfUrl ? (
        <div className="flex shrink-0 justify-end">
          {canOpenFlipbook ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setFlipbookOpen(true)}
            >
              <BookOpen className="size-3.5" aria-hidden />
              {tWarehouse('detail.switchToFlipbook')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ArchiveBorrowReaderPanel
        borrowId={borrowId}
        file={file}
        pdfUrl={pdfUrl}
        expired={expired}
        initialPage={initialPage}
        canWrite={canWrite}
      />

      <Dialog open={flipbookOpen} onOpenChange={setFlipbookOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 top-0 left-0 sm:max-w-none"
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
            <DialogTitle className="truncate text-base">
              {file?.fileName ?? tWarehouse('detail.viewerFlipbook')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {tWarehouse('detail.flipbookDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          {pdfUrl && flipbookOpen ? (
            <FlipbookViewer
              key={`flipbook-dialog-${file?.fileId ?? 'none'}`}
              fileUrl={pdfUrl}
              fileName={file?.fileName}
              className="min-h-0 flex-1"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
