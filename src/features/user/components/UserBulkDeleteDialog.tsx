import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { deleteUsers } from '@/features/user/api/userClient'
import { adminUsersQueryKeyPrefix } from '@/features/user/queries'
import { translateError } from '@/lib/utils/translate-error'

interface UserBulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userIds: Array<string>
  onSuccess?: (deletedIds: Array<string>) => void
}

export function UserBulkDeleteDialog({
  open,
  onOpenChange,
  userIds,
  onSuccess,
}: UserBulkDeleteDialogProps) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (ids: Array<string>) => deleteUsers(ids),
    onSuccess: ({ succeeded, failed }) => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeyPrefix })

      if (failed.length === 0) {
        toast.success(t('delete.bulkSuccess', { count: succeeded.length }))
      } else if (succeeded.length > 0) {
        toast.warning(
          t('delete.bulkPartialSuccess', {
            success: succeeded.length,
            total: userIds.length,
            failed: failed.length,
          }),
        )
      } else {
        toast.error(t('delete.bulkError'))
      }

      if (succeeded.length > 0) {
        onSuccess?.(succeeded)
      }

      if (failed.length === 0) {
        onOpenChange(false)
      }
    },
    onError: (error: Error) => {
      toast.error(translateError(error) || t('delete.bulkError'))
    },
  })

  function handleConfirm() {
    if (userIds.length === 0) return
    mutation.mutate(userIds)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.bulkTitle', { count: userIds.length })}</AlertDialogTitle>
          <AlertDialogDescription>{t('delete.bulkDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={mutation.isPending || userIds.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('actions.deleteSelected', { count: userIds.length })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
