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
import type { UserT } from '@/features/auth/types'
import { deleteUser } from '@/features/user/api/userClient'
import { adminUsersQueryKeyPrefix } from '@/features/user/queries'
import { translateError } from '@/lib/utils/translate-error'

interface UserDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserT | null
}

export function UserDeleteDialog({ open, onOpenChange, user }: UserDeleteDialogProps) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeyPrefix })
      toast.success(t('delete.success'))
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(translateError(error) || t('delete.error'))
    },
  })

  function handleConfirm() {
    if (!user) return
    mutation.mutate(user.id)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialog.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('dialog.deleteDescription')}</AlertDialogDescription>
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
            disabled={mutation.isPending || !user}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
