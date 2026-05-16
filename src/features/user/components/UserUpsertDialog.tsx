import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserT } from '@/features/auth/types'

export type UserUpsertMode = 'create' | 'edit'

interface UserUpsertDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: UserUpsertMode
    user: UserT | null
}

export function UserUpsertDialog({
    open,
    onOpenChange,
    mode,
    user,
}: UserUpsertDialogProps) {
    const { t } = useTranslation('user')
    const { t: tCommon } = useTranslation('common')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')

    useEffect(() => {
        if (!open) return
        if (mode === 'edit' && user) {
            setFullName(user.fullName)
            setEmail(user.email)
        } else {
            setFullName('')
            setEmail('')
        }
    }, [open, mode, user])

    const primaryLabel =
        mode === 'create' ? t('actions.createSubmit') : t('actions.save')

    function handleSubmitMock() {
        // Mock only — replace with mutation later
        console.log('[UserUpsertDialog mock]', { mode, fullName, email, userId: user?.id })
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" showCloseButton>
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="user-name">{t('form.labels.name')}</Label>
                        <Input
                            id="user-name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={t('form.placeholders.name')}
                            autoFocus
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="user-email">{t('form.labels.email')}</Label>
                        <Input
                            id="user-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('form.placeholders.email')}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {tCommon('common.cancel')}
                    </Button>
                    <Button type="button" onClick={handleSubmitMock}>
                        {primaryLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
