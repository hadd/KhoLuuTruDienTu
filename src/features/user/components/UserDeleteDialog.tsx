
import { useTranslation } from 'react-i18next'

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

interface UserDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: UserT | null
}

export function UserDeleteDialog({ open, onOpenChange, user }: UserDeleteDialogProps) {
    const { t } = useTranslation('user')
    const { t: tCommon } = useTranslation('common')

    function handleConfirmMock() {
        console.log('[UserDeleteDialog mock]', user?.id)
        onOpenChange(false)
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('dialog.deleteTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('dialog.deleteDescription')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmMock}>{t('actions.delete')}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
