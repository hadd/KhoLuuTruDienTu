import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table } from '@/components/ui/table'
import type { EditorDraftDossierT } from '@/features/editor-dossiers/types'
import { cn } from '@/lib/utils/cn'

interface EditorDossierTableProps {
  dossiers: Array<EditorDraftDossierT>
  isLoading: boolean
  isError: boolean
  error: Error | null
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onOpenDossier: (dossier: EditorDraftDossierT) => void
  onFinalSave: (dossier: EditorDraftDossierT) => void
  onBulkFinalSave: () => void
  isFinalSavePending: boolean
}

export function EditorDossierTable({
  dossiers,
  isLoading,
  isError,
  error,
  selectedIds,
  onSelectedIdsChange,
  onOpenDossier,
  onFinalSave,
  onBulkFinalSave,
  isFinalSavePending,
}: EditorDossierTableProps) {
  const { t } = useTranslation('editor-dossiers')

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('status.loading')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {error?.message || t('errors.loadFailed')}
      </div>
    )
  }

  const selectableIds = dossiers.map((dossier) => dossier.dossierId)
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length
  const allSelected =
    selectableIds.length > 0 && selectedCount === selectableIds.length
  const someSelected = selectedCount > 0 && selectedCount < selectableIds.length
  const hasSelection = selectedCount > 0

  function toggleDossierSelection(dossierId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(dossierId)
    } else {
      next.delete(dossierId)
    }
    onSelectedIdsChange(next)
  }

  function toggleSelectAllOnPage(checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      selectableIds.forEach((id) => next.add(id))
    } else {
      selectableIds.forEach((id) => next.delete(id))
    }
    onSelectedIdsChange(next)
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <Table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50 text-muted-foreground [&_th]:bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={(value) =>
                    toggleSelectAllOnPage(value === true)
                  }
                  aria-label={t('table.selectAll')}
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th className="px-4 py-3 font-medium">
                {t('table.columns.name')}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {hasSelection ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={onBulkFinalSave}
                    disabled={isFinalSavePending}
                  >
                    {t('actions.finalSaveSelected', { count: selectedCount })}
                  </Button>
                ) : (
                  t('table.columns.actions')
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dossiers.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              dossiers.map((dossier) => {
                const isSelected = selectedIds.has(dossier.dossierId)

                return (
                  <tr
                    key={dossier.assignmentId}
                    className={cn(
                      'transition-colors hover:bg-muted/50',
                      isSelected && 'bg-muted/50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) =>
                          toggleDossierSelection(
                            dossier.dossierId,
                            value === true,
                          )
                        }
                        aria-label={t('table.selectDossier', {
                          name: dossier.name,
                        })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenDossier(dossier)}
                        className="font-medium text-foreground hover:underline"
                      >
                        {dossier.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onFinalSave(dossier)}
                          disabled={isFinalSavePending}
                        >
                          {t('actions.finalSave')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
