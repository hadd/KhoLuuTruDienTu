import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { UserT } from '@/features/auth/types'

import { UserMultiSelectField } from './UserMultiSelectField'

interface AddApproverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  level: number
  users: Array<UserT>
  isLoading: boolean
  existingUserIds: Array<string>
  onSubmit: (userIds: Array<string>) => void
}

export function AddApproverDialog({
  open,
  onOpenChange,
  level,
  users,
  isLoading,
  existingUserIds,
  onSubmit,
}: AddApproverDialogProps) {
  const { t } = useTranslation('group')
  const [selectedUserIds, setSelectedUserIds] = useState<Array<string>>([])

  useEffect(() => {
    if (open) {
      setSelectedUserIds([...existingUserIds])
    }
  }, [open, level, existingUserIds])

  const handleToggle = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(selectedUserIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('card.addApproverDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('card.addApproverDialog.description', { level })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <UserMultiSelectField
            label={t('card.addApproverDialog.fields.approver.label')}
            placeholder={t(
              'card.addApproverDialog.fields.approver.placeholder',
            )}
            selectedLabel={t('card.addApproverDialog.fields.selectedCount', {
              count: selectedUserIds.length,
            })}
            emptyLabel={t('card.addApproverDialog.fields.approver.empty')}
            loadingLabel={t('card.addApproverDialog.fields.approver.loading')}
            users={users}
            isLoading={isLoading}
            selectedIds={selectedUserIds}
            onToggle={handleToggle}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('card.addApproverDialog.actions.cancel')}
            </Button>
            <Button type="submit">
              {t('card.addApproverDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
