import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  exportDisposalAppraisalPl3,
  exportDisposalPhuLucIII,
  getDisposalAppraisalPl3Content,
  getDisposalPl3Suggestions,
  saveDisposalAppraisalPl3Content,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import type { Pl3ContentT } from '@/features/archive-disposal/types'
import { PL3_REQUIRED_FORMATION_KEYS } from '@/features/archive-disposal/lib/pl3-constants'
import { translateError } from '@/lib/utils/translate-error'

const FORMATION_FIELDS = PL3_REQUIRED_FORMATION_KEYS

function pl3StorageKey(catalogId: string) {
  return `disposal-pl3:${catalogId}`
}

function readStoredPl3Content(catalogId: string): Pl3ContentT | null {
  try {
    const raw = localStorage.getItem(pl3StorageKey(catalogId))
    if (!raw) return null
    return JSON.parse(raw) as Pl3ContentT
  } catch {
    return null
  }
}

function writeStoredPl3Content(catalogId: string, content: Pl3ContentT) {
  localStorage.setItem(pl3StorageKey(catalogId), JSON.stringify(content))
}

function isPl3ExportReady(content: Pl3ContentT): boolean {
  return FORMATION_FIELDS.every((key) => content[key]?.trim())
}

type DisposalAppendixPl3DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogId: string
  canEdit: boolean
  initialExport?: boolean
  onExportSuccess?: () => void
  useServerStorage?: boolean
}

export function DisposalAppendixPl3Dialog({
  open,
  onOpenChange,
  catalogId,
  canEdit,
  initialExport = false,
  onExportSuccess,
  useServerStorage = false,
}: DisposalAppendixPl3DialogProps) {
  const { t } = useTranslation('archive-disposal')
  const [content, setContent] = useState<Pl3ContentT | null>(null)
  const [fondName, setFondName] = useState('')
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false)
  const initialExportHandled = useRef(false)

  const serverContentQuery = useQuery({
    queryKey: ['disposal-appraisal-pl3-content', catalogId],
    queryFn: () => getDisposalAppraisalPl3Content(catalogId),
    enabled: open && Boolean(catalogId) && useServerStorage,
  })

  const suggestionsQuery = useQuery({
    queryKey: ['disposal-pl3-suggestions', catalogId],
    queryFn: () => getDisposalPl3Suggestions(catalogId),
    enabled:
      open &&
      Boolean(catalogId) &&
      content === null &&
      (!useServerStorage || (serverContentQuery.isSuccess && !serverContentQuery.data)),
  })

  useEffect(() => {
    if (!open) {
      setContent(null)
      setFondName('')
      initialExportHandled.current = false
      return
    }

    if (useServerStorage) {
      if (!serverContentQuery.isSuccess) return
      if (serverContentQuery.data) {
        setContent(serverContentQuery.data)
        setFondName('')
        return
      }
      if (suggestionsQuery.data) {
        setContent(suggestionsQuery.data.content)
        setFondName(suggestionsQuery.data.fondName)
      }
      return
    }

    const stored = readStoredPl3Content(catalogId)
    if (stored) {
      setContent(stored)
      setFondName('')
      return
    }

    if (suggestionsQuery.data) {
      setContent(suggestionsQuery.data.content)
      setFondName(suggestionsQuery.data.fondName)
    }
  }, [
    open,
    catalogId,
    suggestionsQuery.data,
    serverContentQuery.data,
    serverContentQuery.isSuccess,
    useServerStorage,
  ])

  useEffect(() => {
    if (!open || !canEdit || !content) return
    const timer = window.setTimeout(() => {
      if (useServerStorage) {
        void saveDisposalAppraisalPl3Content(catalogId, content)
      } else {
        writeStoredPl3Content(catalogId, content)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [open, canEdit, catalogId, content, useServerStorage])

  const exportMutation = useMutation({
    mutationFn: () =>
      useServerStorage
        ? exportDisposalAppraisalPl3(catalogId, content!)
        : exportDisposalPhuLucIII(catalogId, content!),
    onSuccess: () => {
      toast.success(t('proposal.exportAppendixSuccess'))
      onExportSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const handleExport = useCallback(() => {
    if (!content || !isPl3ExportReady(content)) {
      toast.error(t('proposal.pl3.missingRequired'))
      return
    }
    exportMutation.mutate()
  }, [content, exportMutation, t])

  useEffect(() => {
    if (
      !open ||
      !initialExport ||
      initialExportHandled.current ||
      !content ||
      suggestionsQuery.isPending
    ) {
      return
    }
    initialExportHandled.current = true
    if (isPl3ExportReady(content)) {
      handleExport()
    }
  }, [open, initialExport, content, suggestionsQuery.isPending, handleExport])

  const applySuggestions = (data: Pl3ContentT, nextFondName: string) => {
    setContent(data)
    setFondName(nextFondName)
    if (canEdit) {
      if (useServerStorage) {
        void saveDisposalAppraisalPl3Content(catalogId, data)
      } else {
        writeStoredPl3Content(catalogId, data)
      }
    }
  }

  const handleReloadSuggestions = async () => {
    setReloadConfirmOpen(false)
    try {
      const data = await getDisposalPl3Suggestions(catalogId)
      applySuggestions(data.content, data.fondName)
      toast.success(t('proposal.pl3.reloadSuccess'))
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  const updateField = <K extends keyof Pl3ContentT>(key: K, value: Pl3ContentT[K]) => {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const isLoading = useServerStorage
    ? content === null && (serverContentQuery.isPending || suggestionsQuery.isPending)
    : content === null && suggestionsQuery.isPending
  const displayFondName = fondName || suggestionsQuery.data?.fondName

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{t('proposal.pl3.composeTitle')}</DialogTitle>
            {displayFondName ? (
              <p className="text-sm text-muted-foreground">
                {t('proposal.pl3.fondLabel', { fondName: displayFondName })}
              </p>
            ) : null}
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                {t('proposal.pl3.loading')}
              </div>
            ) : content ? (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t('proposal.pl3.sectionFormation')}</h3>
                  {FORMATION_FIELDS.map((field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`pl3-${field}`}>{t(`proposal.pl3.fields.${field}`)}</Label>
                      <Textarea
                        id={`pl3-${field}`}
                        value={content[field]}
                        disabled={!canEdit}
                        rows={3}
                        onChange={(event) => updateField(field, event.target.value)}
                      />
                    </div>
                  ))}
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t('proposal.pl3.sectionCounts')}</h3>
                  <div className="space-y-2">
                    <Label htmlFor="pl3-countsDetail">{t('proposal.pl3.fields.countsDetail')}</Label>
                    <Textarea
                      id="pl3-countsDetail"
                      value={content.countsDetail}
                      disabled={!canEdit}
                      rows={5}
                      onChange={(event) => updateField('countsDetail', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pl3-timeRangeText">{t('proposal.pl3.fields.timeRangeText')}</Label>
                    <Textarea
                      id="pl3-timeRangeText"
                      value={content.timeRangeText}
                      disabled={!canEdit}
                      rows={2}
                      onChange={(event) => updateField('timeRangeText', event.target.value)}
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">{t('proposal.pl3.sectionGroups')}</h3>
                  <div className="space-y-2">
                    <Label htmlFor="pl3-expiredGroupSummary">
                      {t('proposal.pl3.fields.expiredGroupSummary')}
                    </Label>
                    <Textarea
                      id="pl3-expiredGroupSummary"
                      value={content.expiredGroupSummary}
                      disabled={!canEdit}
                      rows={6}
                      onChange={(event) => updateField('expiredGroupSummary', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pl3-duplicateGroupSummary">
                      {t('proposal.pl3.fields.duplicateGroupSummary')}
                    </Label>
                    <Textarea
                      id="pl3-duplicateGroupSummary"
                      value={content.duplicateGroupSummary}
                      disabled={!canEdit}
                      rows={5}
                      onChange={(event) => updateField('duplicateGroupSummary', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pl3-otherGroupSummary">
                      {t('proposal.pl3.fields.otherGroupSummary')}
                    </Label>
                    <Textarea
                      id="pl3-otherGroupSummary"
                      value={content.otherGroupSummary}
                      disabled={!canEdit}
                      rows={4}
                      onChange={(event) => updateField('otherGroupSummary', event.target.value)}
                    />
                  </div>
                </section>
              </>
            ) : suggestionsQuery.isError ? (
              <p className="text-sm text-destructive">{t('proposal.pl3.loadFailed')}</p>
            ) : null}
          </div>

          <DialogFooter className="border-t px-6 py-4 sm:justify-between">
            <div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => setReloadConfirmOpen(true)}
                >
                  {t('proposal.pl3.reloadSuggestions')}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('proposal.pl3.close')}
              </Button>
              <Button
                type="button"
                disabled={isLoading || !content || exportMutation.isPending}
                onClick={handleExport}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t('proposal.exportPhuLucIII')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={reloadConfirmOpen} onOpenChange={setReloadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('proposal.pl3.reloadConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('proposal.pl3.reloadConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('proposal.pl3.close')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReloadSuggestions}>
              {t('proposal.pl3.reloadSuggestions')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function tryExportPl3FromStorage(catalogId: string): Pl3ContentT | null {
  const stored = readStoredPl3Content(catalogId)
  if (!stored || !isPl3ExportReady(stored)) return null
  return stored
}
