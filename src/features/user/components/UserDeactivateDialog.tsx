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

    function handleConfirmMock() {
        console.log('[UserDeactivateDialog mock]', user?.id)
        onOpenChange(false)
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('dialog.deactivateTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('dialog.deactivateDescription')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmMock}>
                        {t('actions.deactivateConfirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}