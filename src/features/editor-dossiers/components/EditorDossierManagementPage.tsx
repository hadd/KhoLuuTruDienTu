import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EditorDossierTable } from '@/features/editor-dossiers/components/EditorDossierTable'
import {
  editorDraftDossiersQueryOptions,
  useSubmitEditorDraftFinalSaveMutation,
} from '@/features/editor-dossiers/queries'
import type { EditorDraftDossierT } from '@/features/editor-dossiers/types'
import { translateError } from '@/lib/utils/translate-error'

interface EditorDossierManagementPageProps {
  searchQuery?: string
  onSearchQueryChange?: (value: string) => void
}

interface PendingFinalSaveT {
  dossierIds: Array<string>
  dossierName?: string
}

export function EditorDossierManagementPage({
  searchQuery = '',
  onSearchQueryChange,
}: EditorDossierManagementPageProps) {
  const { t } = useTranslation('editor-dossiers')
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingFinalSave, setPendingFinalSave] =
    useState<PendingFinalSaveT | null>(null)

  const { data, isLoading, isError, error } = useQuery(
    editorDraftDossiersQueryOptions(),
  )
  const finalSaveMutation = useSubmitEditorDraftFinalSaveMutation()

  const dossiers = useMemo(() => {
    const items = data ?? []
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return items
    return items.filter((dossier) =>
      dossier.name.toLowerCase().includes(needle),
    )
  }, [data, searchQuery])

  function handleOpenDossier(dossier: EditorDraftDossierT) {
    void navigate({
      to: '/app/data',
      search: {
        dossierId: dossier.dossierId,
        nodeId: dossier.dossierId,
      },
    })
  }

  function requestFinalSave(dossierIds: Array<string>, dossierName?: string) {
    if (dossierIds.length === 0) return
    setPendingFinalSave({ dossierIds, dossierName })
  }

  async function handleFinalSave(dossierIds: Array<string>) {
    if (dossierIds.length === 0) return

    try {
      const result = await finalSaveMutation.mutateAsync(dossierIds)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        dossierIds.forEach((id) => next.delete(id))
        return next
      })

      if (result.failedCount > 0 && result.submittedCount > 0) {
        toast.warning(
          t('success.finalSavePartial', {
            submitted: result.submittedCount,
            failed: result.failedCount,
          }),
        )
        return
      }

      if (result.failedCount > 0) {
        toast.error(t('errors.finalSaveFailed'))
        return
      }

      toast.success(t('success.finalSave'))
    } catch (submitError) {
      toast.error(
        translateError(submitError) || t('errors.finalSaveFailed'),
      )
    } finally {
      setPendingFinalSave(null)
    }
  }

  const isBulkFinalSave =
    pendingFinalSave !== null && pendingFinalSave.dossierIds.length > 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        </div>
        {onSearchQueryChange ? (
          <Input
            className="max-w-md border-input bg-background"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            aria-label={t('search.placeholder')}
          />
        ) : null}
      </div>

      <Card variant="list" className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <EditorDossierTable
            dossiers={dossiers}
            isLoading={isLoading}
            isError={isError}
            error={error}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onOpenDossier={handleOpenDossier}
            onFinalSave={(dossier) =>
              requestFinalSave([dossier.dossierId], dossier.name)
            }
            onBulkFinalSave={() =>
              requestFinalSave(Array.from(selectedIds))
            }
            isFinalSavePending={finalSaveMutation.isPending}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingFinalSave !== null}
        onOpenChange={(open) => {
          if (!open && !finalSaveMutation.isPending) {
            setPendingFinalSave(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('finalSaveConfirm.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {isBulkFinalSave
                ? t('finalSaveConfirm.confirmDescriptionBulk', {
                    count: pendingFinalSave?.dossierIds.length ?? 0,
                  })
                : t('finalSaveConfirm.confirmDescription', {
                    name: pendingFinalSave?.dossierName ?? '',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalSaveMutation.isPending}>
              {t('finalSaveConfirm.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (!pendingFinalSave) return
                void handleFinalSave(pendingFinalSave.dossierIds)
              }}
              disabled={finalSaveMutation.isPending}
            >
              {t('finalSaveConfirm.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
