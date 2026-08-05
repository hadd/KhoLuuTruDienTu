import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  archiveBorrowKeys,
  createArchiveBorrowMutationOptions,
} from '@/features/archive-borrow/queries'
import type { CreateArchiveBorrowItemInputT } from '@/features/archive-borrow/types'
import { translateError } from '@/lib/utils/translate-error'

export type ArchiveBorrowRequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: Array<CreateArchiveBorrowItemInputT>
  itemLabels?: Array<string>
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

export function ArchiveBorrowRequestDialog({
  open,
  onOpenChange,
  items,
  itemLabels = [],
}: ArchiveBorrowRequestDialogProps) {
  const { t } = useTranslation('archive-borrow')
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [requestedFrom, setRequestedFrom] = useState(defaultFromValue)
  const [requestedUntil, setRequestedUntil] = useState(defaultUntilValue)

  const createMutation = useMutation({
    ...createArchiveBorrowMutationOptions(),
    onSuccess: () => {
      toast.success(t('page.submitRequest'))
      void queryClient.invalidateQueries({ queryKey: archiveBorrowKeys.all })
      onOpenChange(false)
      setReason('')
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.createFailed'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('page.requestDialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">{t('page.selectedItems')}</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {itemLabels.length > 0
                ? itemLabels.map((label) => <li key={label}>{label}</li>)
                : items.map((item, index) => (
                    <li key={`${item.dossierId}-${index}`}>
                      {item.itemKind === 'FILE'
                        ? `FILE ${item.fileId}`
                        : `DOSSIER ${item.dossierId}`}
                    </li>
                  ))}
            </ul>
          </div>

          <label className="block space-y-1 text-sm">
            <span>{t('page.reason')}</span>
            <Textarea
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
              items.length === 0 ||
              !requestedFrom ||
              !requestedUntil
            }
            onClick={() =>
              createMutation.mutate({
                reason: reason.trim(),
                requestedFrom: new Date(requestedFrom).toISOString(),
                requestedUntil: new Date(requestedUntil).toISOString(),
                items,
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
