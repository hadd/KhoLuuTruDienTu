import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRejectCheckerDossierMutation } from '@/features/data-management/queries'

export function DocumentRejectDialog({
  open,
  onOpenChange,
  dossierId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  onSuccess: () => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const [notes, setNotes] = useState('')
  const rejectMutation = useRejectCheckerDossierMutation('qc')

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setNotes('')
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    try {
      await rejectMutation.mutateAsync({ dossierId, notes: notes.trim() })
      toast.success(t('metadata.rejectSuccess'))
      handleOpenChange(false)
      await onSuccess()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('metadata.rejectError')
      toast.error(message)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('metadata.rejectDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('metadata.rejectDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reject-notes">{t('metadata.rejectDialog.notesLabel')}</Label>
          <Textarea
            id="reject-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('metadata.rejectDialog.notesPlaceholder')}
            disabled={rejectMutation.isPending}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rejectMutation.isPending}>
            {t('metadata.rejectDialog.cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {rejectMutation.isPending
              ? t('metadata.rejecting')
              : t('metadata.rejectDialog.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
