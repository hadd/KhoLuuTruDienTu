import { Download, FileEdit, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  exportDisposalAppraisalMinutesCouncil,
  exportDisposalAppraisalMinutesDestruction,
  exportDisposalAppraisalPl2,
  exportDisposalAppraisalPl3,
  getDisposalAppraisalDocuments,
  markDisposalAppraisalSubmitted,
  uploadDisposalAppraisalSignedMinutes,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import { openDisposalDocumentEditorWindow } from '@/features/archive-disposal/components/DisposalDocumentEditorPage'
import type { AppraisalDocumentTypeT, EditableDocumentSlugT } from '@/features/archive-disposal/types'
import { translateError } from '@/lib/utils/translate-error'

type DisposalAppraisalExportPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogId: string
  canEditPl3: boolean
}

const DOCUMENT_ROWS: Array<{
  type: AppraisalDocumentTypeT
  slug?: EditableDocumentSlugT
  labelKey: string
  editable: boolean
  exportFn: (catalogId: string) => Promise<void>
}> = [
  {
    type: 'PL2',
    labelKey: 'appraisalExport.pl2',
    editable: false,
    exportFn: exportDisposalAppraisalPl2,
  },
  {
    type: 'PL3',
    slug: 'pl3',
    labelKey: 'appraisalExport.pl3',
    editable: true,
    exportFn: exportDisposalAppraisalPl3,
  },
  {
    type: 'MINUTES_COUNCIL',
    slug: 'minutes-council',
    labelKey: 'appraisalExport.minutesCouncil',
    editable: true,
    exportFn: exportDisposalAppraisalMinutesCouncil,
  },
  {
    type: 'MINUTES_DESTRUCTION',
    slug: 'minutes-destruction',
    labelKey: 'appraisalExport.minutesDestruction',
    editable: true,
    exportFn: exportDisposalAppraisalMinutesDestruction,
  },
]

export function DisposalAppraisalExportPanel({
  open,
  onOpenChange,
  catalogId,
  canEditPl3,
}: DisposalAppraisalExportPanelProps) {
  const { t } = useTranslation('archive-disposal')
  const queryClient = useQueryClient()
  const [exportingType, setExportingType] = useState<AppraisalDocumentTypeT | null>(null)
  const councilFileRef = useRef<HTMLInputElement>(null)
  const destructionFileRef = useRef<HTMLInputElement>(null)
  const [councilFile, setCouncilFile] = useState<File | null>(null)
  const [destructionFile, setDestructionFile] = useState<File | null>(null)

  const openDocumentEditor = (slug: EditableDocumentSlugT, titleKey: string) => {
    const popup = openDisposalDocumentEditorWindow(catalogId, slug, {
      canEdit: canEditPl3,
      titleKey,
    })
    if (!popup) {
      toast.error(t('documentEditor.popupBlocked'))
    }
  }

  const statusQuery = useQuery({
    queryKey: ['archive-disposal', 'appraisal-documents', catalogId],
    queryFn: () => getDisposalAppraisalDocuments(catalogId),
    enabled: open && Boolean(catalogId),
  })

  const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'appraisal-documents', catalogId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'council-evaluations'],
      })
      void queryClient.invalidateQueries({ queryKey: ['archive-disposal', 'catalog', catalogId] })
      void queryClient.invalidateQueries({ queryKey: ['archive-disposal', 'catalogs'] })
  }

  const uploadMutation = useMutation({
    mutationFn: () =>
      uploadDisposalAppraisalSignedMinutes(catalogId, councilFile!, destructionFile!),
    onSuccess: () => {
      toast.success(t('appraisalExport.uploadSuccess'))
      setCouncilFile(null)
      setDestructionFile(null)
      if (councilFileRef.current) councilFileRef.current.value = ''
      if (destructionFileRef.current) destructionFileRef.current.value = ''
      invalidate()
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const submitMutation = useMutation({
    mutationFn: () => markDisposalAppraisalSubmitted(catalogId),
    onSuccess: () => {
      toast.success(t('appraisalExport.submitSuccess'))
      invalidate()
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const handleExport = async (row: (typeof DOCUMENT_ROWS)[number]) => {
    setExportingType(row.type)
    try {
      await row.exportFn(catalogId)
      toast.success(t('appraisalExport.exportSuccess'))
      invalidate()
    } catch (error) {
      if (row.editable && row.slug && canEditPl3) {
        openDocumentEditor(row.slug, row.labelKey)
      } else {
        toast.error(translateError(error))
      }
    } finally {
      setExportingType(null)
    }
  }

  const status = statusQuery.data
  const docStatus = (type: AppraisalDocumentTypeT) =>
    status?.documents.find((d) => d.documentType === type)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          resizable
          className="flex h-[min(85vh,52rem)] w-[min(64rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col"
        >
          <DialogHeader>
            <DialogTitle>{t('appraisalExport.title')}</DialogTitle>
            <DialogDescription>{t('appraisalExport.description')}</DialogDescription>
          </DialogHeader>

          {statusQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('appraisalExport.loading')}
            </div>
          ) : null}

          {status ? (
            <div className="mt-4 space-y-6">
              {status.evaluationsLocked ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  {t('appraisalExport.votingLocked')}
                </p>
              ) : null}

              <ul className="space-y-3">
                {DOCUMENT_ROWS.map((row) => {
                  const doc = docStatus(row.type)
                  const isExporting = exportingType === row.type
                  return (
                    <li
                      key={row.type}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-sm">{t(row.labelKey)}</p>
                        <Badge variant={doc?.hasDraft ? 'default' : 'secondary'}>
                          {doc?.hasDraft
                            ? t('appraisalExport.statusExported', {
                                date: doc.draftExportedAt
                                  ? new Date(doc.draftExportedAt).toLocaleString('vi-VN')
                                  : '',
                              })
                            : t('appraisalExport.statusNotExported')}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {row.editable && row.slug && canEditPl3 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={Boolean(status.appraisalSubmittedAt) || isExporting}
                            onClick={() => openDocumentEditor(row.slug!, row.labelKey)}
                          >
                            <FileEdit className="mr-1 size-4" />
                            {t('appraisalExport.edit')}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(status.appraisalSubmittedAt) || isExporting}
                          onClick={() => void handleExport(row)}
                        >
                          {isExporting ? (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                          ) : (
                            <Download className="mr-1 size-4" />
                          )}
                          {doc?.hasDraft ? t('appraisalExport.reExport') : t('appraisalExport.export')}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium text-sm">{t('appraisalExport.signedSectionTitle')}</p>
                <p className="text-muted-foreground text-xs">{t('appraisalExport.signedSectionHint')}</p>
                <div className="space-y-2">
                  <Label htmlFor="signed-council">{t('appraisalExport.signedCouncil')}</Label>
                  <input
                    ref={councilFileRef}
                    id="signed-council"
                    type="file"
                    accept="application/pdf"
                    className="block w-full text-sm"
                    onChange={(e) => setCouncilFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signed-destruction">{t('appraisalExport.signedDestruction')}</Label>
                  <input
                    ref={destructionFileRef}
                    id="signed-destruction"
                    type="file"
                    accept="application/pdf"
                    className="block w-full text-sm"
                    onChange={(e) => setDestructionFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!councilFile || !destructionFile || uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  {t('appraisalExport.uploadSigned')}
                </Button>
              </div>

              <div className="space-y-2">
                {status.readyToSubmit ? (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t('appraisalExport.readyToSubmit')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('appraisalExport.missing')}:{' '}
                    {status.missingComponents.length
                      ? status.missingComponents.join(', ')
                      : t('appraisalExport.missingUnknown')}
                  </p>
                )}
                {status.appraisalSubmittedAt ? (
                  <Badge>{t('appraisalExport.submitted')}</Badge>
                ) : (
                  <Button
                    type="button"
                    disabled={!status.readyToSubmit || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {t('appraisalExport.markSubmitted')}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
