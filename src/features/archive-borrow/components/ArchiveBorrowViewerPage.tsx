import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileText, FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  archiveBorrowDossierMetadataQueryOptions,
  archiveBorrowRequestQueryOptions,
  archiveBorrowViewModelQueryOptions,
} from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowViewerDossierT,
  ArchiveBorrowViewerFileT,
} from '@/features/archive-borrow/types'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import {
  matchMetadataFields,
  parseDossierMetadata,
} from '@/features/data-management/lib/metadataHelpers'
import { warehouseSubTabsTriggerClassName } from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'
import { env } from '@/lib/utils/env'
import { translateError } from '@/lib/utils/translate-error'

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

function BackLink() {
  const { t } = useTranslation('archive-borrow')
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
  const requestQuery = useQuery(archiveBorrowRequestQueryOptions(borrowId))
  const [now, setNow] = useState(() => Date.now())
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'dossier' | 'documents'>('documents')

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

  const metadataQuery = useQuery({
    ...archiveBorrowDossierMetadataQueryOptions(
      borrowId,
      selectedDossier?.id ?? null,
    ),
    enabled: canLoadViewModel && Boolean(selectedDossier?.id),
  })

  const dossierMetadata = useMemo(
    () => parseDossierMetadata(metadataQuery.data?.metadata ?? null),
    [metadataQuery.data?.metadata],
  )

  const selectedFile: ArchiveBorrowViewerFileT | null = useMemo(() => {
    if (!selectedFileId) return files[0] ?? null
    return files.find((f) => f.fileId === selectedFileId) ?? files[0] ?? null
  }, [files, selectedFileId])

  const selectedFields = useMemo(() => {
    if (!selectedFile || !dossierMetadata?.metadata_groups?.length) return []
    const fileRef = selectedFile.filePath || selectedFile.fileName
    return (
      matchMetadataFields(fileRef, dossierMetadata.metadata_groups) ?? []
    )
  }, [dossierMetadata, selectedFile])

  const pdfUrl =
    selectedFile && canLoadViewModel
      ? buildDipContentApiUrl(borrowId, selectedFile.fileId)
      : null

  const remainingLabel = useMemo(() => {
    if (!approvedUntilMs) return '—'
    return formatCountdown(approvedUntilMs - now)
  }, [approvedUntilMs, now])

  const showDossierNav = dossiers.length > 1

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
                ) : singleFileMode ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                    <h3 className="shrink-0 truncate text-sm font-medium text-foreground">
                      {selectedFile?.fileName ?? t('page.viewerFileMetadata')}
                    </h3>
                    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-2">
                      <MetadataPanel
                        file={selectedFile}
                        fields={selectedFields}
                        isPending={metadataQuery.isPending}
                      />
                      <PdfPanel
                        file={selectedFile}
                        pdfUrl={pdfUrl}
                        expired={expired}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
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
                    <div className="grid min-h-0 min-w-0 gap-3 overflow-hidden lg:grid-cols-2">
                      <MetadataPanel
                        file={selectedFile}
                        fields={selectedFields}
                        isPending={metadataQuery.isPending}
                      />
                      <PdfPanel
                        file={selectedFile}
                        pdfUrl={pdfUrl}
                        expired={expired}
                      />
                    </div>
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

function MetadataPanel({
  file,
  fields,
  isPending,
}: {
  file: ArchiveBorrowViewerFileT | null
  fields: Array<{ name: string; display?: string | null; value: unknown }>
  isPending: boolean
}) {
  const { t } = useTranslation('archive-borrow')

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
      <div className="shrink-0 space-y-2 border-b px-3 py-2">
        <p className="truncate text-sm font-medium">
          {file?.fileName ?? t('page.viewerFileMetadata')}
        </p>
        {file ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('page.viewerDocumentType')}
            </p>
            <p className="text-sm text-foreground">
              {file.documentTypeName?.trim() || t('page.viewerDocumentTypeNone')}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t('page.viewerReadOnlyHint')}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          {isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {!isPending && fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('page.viewerNoFileMetadata')}
            </p>
          ) : null}
          {fields.map((field, index) => (
            <div
              key={`${field.name}-${index}`}
              className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]"
            >
              <dt className="text-xs text-muted-foreground">
                {field.display || field.name}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-sm">
                {coerceMetadataText(field.value) || '—'}
              </dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PdfPanel({
  file,
  pdfUrl,
  expired,
}: {
  file: ArchiveBorrowViewerFileT | null
  pdfUrl: string | null
  expired: boolean
}) {
  const { t } = useTranslation('archive-borrow')

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
      {expired ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          {t('page.viewerExpired')}
        </div>
      ) : pdfUrl ? (
        <PdfViewer
          key={file?.fileId ?? 'none'}
          fileUrl={pdfUrl}
          fileName={file?.fileName}
          className="min-h-0 flex-1"
          showBorder={false}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">{t('page.viewerNoPdf')}</p>
        </div>
      )}
    </div>
  )
}
