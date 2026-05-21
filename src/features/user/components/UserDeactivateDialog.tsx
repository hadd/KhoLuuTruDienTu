import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateUserStatus } from '../api/userClient'
import { adminUsersQueryKey } from '../queries'

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

interface UserDeactivateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: UserT | null
}

export function UserDeactivateDialog({
    open,
    onOpenChange,
    user,
}: UserDeactivateDialogProps) {
    const { t } = useTranslation('user')
    const { t: tCommon } = useTranslation('common')
    const queryClient = useQueryClient()

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No user selected')
            return updateUserStatus(user.id, !user.active)
        },
        onSuccess: () => {
            toast.success(t('actions.statusChangeSuccess', 'Status updated successfully'))
            void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey })
            onOpenChange(false)
        },
        onError: (err) => {
            toast.error(t('actions.statusChangeError', 'Failed to update status'))
            console.error(err)
        },
    })

    function handleConfirm(e: React.MouseEvent) {
        e.preventDefault()
        mutate()
    }

    // Toggle dialog text based on current status
    const isActive = user?.active ?? false

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{isActive ? t('dialog.deactivateTitle') : t('dialog.activateTitle', 'Mở khóa tài khoản?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isActive ? t('dialog.deactivateDescription') : t('dialog.activateDescription', 'Bạn chắc chắn muốn mở khóa tài khoản này? Người dùng sẽ có thể đăng nhập bình thường.')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>{tCommon('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                        {isActive ? t('actions.deactivateConfirm', 'Khóa tài khoản') : t('actions.activateConfirm', 'Xác nhận mở khóa')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}