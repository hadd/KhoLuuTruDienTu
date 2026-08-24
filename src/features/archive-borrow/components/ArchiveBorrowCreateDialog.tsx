import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/common/date/DateTimePicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  archiveBorrowEligibleDossiersQueryOptions,
  archiveBorrowKeys,
  createArchiveBorrowMutationOptions,
} from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowEligibleDossierT,
  CreateArchiveBorrowItemInputT,
} from '@/features/archive-borrow/types'
import { translateError } from '@/lib/utils/translate-error'
import { cn } from '@/lib/utils/cn'

export type ArchiveBorrowInitialItemT =
  | { kind?: 'DOSSIER'; id?: string; dossierId?: string; name: string }
  | {
      kind: 'FILE'
      dossierId: string
      fileId: string
      fileName: string
      dossierName?: string
    }

export type ArchiveBorrowCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialItems?: Array<ArchiveBorrowInitialItemT>
  onCreated?: () => void
}

type SelectedItem =
  | {
      key: string
      item: CreateArchiveBorrowItemInputT
      label: string
    }

function defaultFromValue() {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultUntilValue() {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 5)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dossierKey(dossierId: string) {
  return `DOSSIER:${dossierId}`
}

function fileKey(dossierId: string, fileId: string) {
  return `FILE:${dossierId}:${fileId}`
}

export function ArchiveBorrowCreateDialog({
  open,
  onOpenChange,
  initialItems,
  onCreated,
}: ArchiveBorrowCreateDialogProps) {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [selected, setSelected] = useState<Array<SelectedItem>>([])
  const [reason, setReason] = useState('')
  const [requestedFrom, setRequestedFrom] = useState(defaultFromValue)
  const [requestedUntil, setRequestedUntil] = useState(defaultUntilValue)

  useEffect(() => {
    if (open && initialItems && initialItems.length > 0) {
      setSelected(
        initialItems.map((item) => {
          if (item.kind === 'FILE') {
            const key = fileKey(item.dossierId, item.fileId)
            return {
              key,
              item: {
                itemKind: 'FILE',
                dossierId: item.dossierId,
                fileId: item.fileId,
              },
              label: item.dossierName
                ? `${item.dossierName} / ${item.fileName}`
                : item.fileName,
            }
          }
          const targetDossierId = item.dossierId ?? item.id ?? ''
          const key = dossierKey(targetDossierId)
          return {
            key,
            item: { itemKind: 'DOSSIER', dossierId: targetDossierId },
            label: item.name,
          }
        }),
      )
    }
  }, [open, initialItems])

  const searchQuery = useQuery(
    archiveBorrowEligibleDossiersQueryOptions(deferredSearch),
  )

  const selectedKeys = useMemo(
    () => new Set(selected.map((item) => item.key)),
    [selected],
  )

  const createMutation = useMutation({
    ...createArchiveBorrowMutationOptions(),
    onSuccess: () => {
      toast.success(t('page.submitRequest'))
      void queryClient.invalidateQueries({ queryKey: archiveBorrowKeys.all })
      onOpenChange(false)
      onCreated?.()
      resetForm()
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.createFailed'))
    },
  })

  function resetForm() {
    setSearch('')
    setSelected([])
    setReason('')
    setRequestedFrom(defaultFromValue())
    setRequestedUntil(defaultUntilValue())
  }

  function toggleDossier(dossier: ArchiveBorrowEligibleDossierT) {
    const key = dossierKey(dossier.id)
    setSelected((prev) => {
      if (prev.some((item) => item.key === key)) {
        return prev.filter((item) => item.key !== key)
      }
      // Selecting whole dossier replaces any individual files from that dossier
      const withoutFiles = prev.filter(
        (item) =>
          !(
            item.item.itemKind === 'FILE' &&
            item.item.dossierId === dossier.id
          ),
      )
      return [
        ...withoutFiles,
        {
          key,
          item: { itemKind: 'DOSSIER', dossierId: dossier.id },
          label: dossier.name,
        },
      ]
    })
  }

  function toggleFile(
    dossier: ArchiveBorrowEligibleDossierT,
    fileId: string,
    fileName: string,
  ) {
    const key = fileKey(dossier.id, fileId)
    setSelected((prev) => {
      if (prev.some((item) => item.key === key)) {
        return prev.filter((item) => item.key !== key)
      }
      // Selecting a file removes whole-dossier selection for that dossier
      const withoutDossier = prev.filter(
        (item) => item.key !== dossierKey(dossier.id),
      )
      return [
        ...withoutDossier,
        {
          key,
          item: {
            itemKind: 'FILE',
            dossierId: dossier.id,
            fileId,
          },
          label: `${dossier.name} / ${fileName}`,
        },
      ]
    })
  }

  const results = searchQuery.data ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetForm()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('page.requestDialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!(initialItems && initialItems.length > 0) ? (
            <>
              <label className="block space-y-1 text-sm">
                <span>{t('page.searchDossiers')}</span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('page.searchDossiersPlaceholder')}
                  autoFocus
                />
              </label>

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                {deferredSearch.length < 2 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    {t('page.searchMinChars')}
                  </p>
                ) : searchQuery.isFetching ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    {t('page.searching')}
                  </p>
                ) : searchQuery.isError ? (
                  <p className="px-1 py-2 text-sm text-destructive">
                    {translateError(searchQuery.error) || t('errors.searchFailed')}
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    {t('page.searchEmpty')}
                  </p>
                ) : (
                  results.map((dossier) => {
                    const wholeSelected = selectedKeys.has(dossierKey(dossier.id))
                    return (
                      <div
                        key={dossier.id}
                        className="rounded-md border bg-muted/20 p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {dossier.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {dossier.folderPath}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('page.securityLevel')}:{' '}
                              {dossier.securityLevelName ?? '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('page.fileCount', { count: dossier.fileCount })}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={wholeSelected ? 'default' : 'outline'}
                            disabled={dossier.fileCount === 0}
                            onClick={() => toggleDossier(dossier)}
                          >
                            {wholeSelected
                              ? t('page.selectedDossier')
                              : t('page.selectDossier')}
                          </Button>
                        </div>
                        {dossier.files.length > 0 ? (
                          <ul className="mt-2 space-y-1 border-t pt-2">
                            {dossier.files.map((file) => {
                              const isSelected = selectedKeys.has(
                                fileKey(dossier.id, file.id),
                              )
                              return (
                                <li key={file.id}>
                                  <button
                                    type="button"
                                    className={cn(
                                      'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs',
                                      isSelected
                                        ? 'bg-primary/10 text-foreground'
                                        : 'hover:bg-muted',
                                    )}
                                    onClick={() =>
                                      toggleFile(dossier, file.id, file.fileName)
                                    }
                                  >
                                    <span className="truncate">{file.fileName}</span>
                                    <span className="shrink-0 text-muted-foreground">
                                      {isSelected
                                        ? t('page.selectedFile')
                                        : t('page.selectFile')}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : null}

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">{t('page.selectedItems')}</p>
            {selected.length === 0 ? (
              <p className="text-muted-foreground">{t('page.noItemsSelected')}</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground break-all [overflow-wrap:anywhere]">
                {selected.map((item) => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            )}
          </div>

          <label className="block space-y-1 text-sm">
            <span>{t('page.reason')}</span>
            <Textarea
              className="max-w-full break-all [overflow-wrap:anywhere]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>{t('page.requestedFrom')}</span>
              <DateTimePicker
                value={requestedFrom}
                onChange={setRequestedFrom}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t('page.requestedUntil')}</span>
              <DateTimePicker
                value={requestedUntil}
                onChange={setRequestedUntil}
              />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('page.back')}
          </Button>
          <Button
            disabled={
              createMutation.isPending ||
              !reason.trim() ||
              selected.length === 0 ||
              !requestedFrom ||
              !requestedUntil
            }
            onClick={() =>
              createMutation.mutate({
                reason: reason.trim(),
                requestedFrom: new Date(requestedFrom).toISOString(),
                requestedUntil: new Date(requestedUntil).toISOString(),
                items: selected.map((item) => item.item),
              })
            }
          >
            {createMutation.isPending
              ? t('page.creating')
              : t('page.submitRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
