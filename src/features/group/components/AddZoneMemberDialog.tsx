import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { adminUsersByRoleQueryOptions } from '@/features/user/queries'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { groupConfigStore } from '@/features/group/store'
import { mapUserToZoneMember } from '@/features/group/lib/groupConfigHelpers'
import type { GroupConfigLevelTypeT } from '@/features/group/types'
import { UserMultiSelectField } from './UserMultiSelectField'

const EDITOR_ROLE_ID = 'editor'
const QC_ROLE_ID = 'qc'

interface AddZoneMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  levelId: string
  levelType: GroupConfigLevelTypeT
  levelName: string
  existingMemberIds: Array<string>
}

export function AddZoneMemberDialog({
  open,
  onOpenChange,
  groupId,
  levelId,
  levelType,
  levelName,
  existingMemberIds,
}: AddZoneMemberDialogProps) {
  const { t } = useTranslation('group')
  const roleId = levelType === 'editor' ? EDITOR_ROLE_ID : QC_ROLE_ID
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data: usersData, isLoading } = useQuery({
    ...adminUsersByRoleQueryOptions(roleId),
    enabled: open,
  })

  const availableUsers = (usersData?.items ?? []).filter(
    (user) => !existingMemberIds.includes(user.id),
  )

  useEffect(() => {
    if (open) {
      setSelectedUserId(null)
    }
  }, [open, levelId])

  const handleToggle = (userId: string) => {
    setSelectedUserId((prev) => (prev === userId ? null : userId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return

    const user = availableUsers.find((u) => u.id === selectedUserId)
    if (!user) return

    groupConfigStore.addZoneMember(groupId, levelId, mapUserToZoneMember(user))
    toast.success(t('configTemplate.addMemberDialog.success'))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('configTemplate.addMemberDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('configTemplate.addMemberDialog.description', { level: levelName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <UserMultiSelectField
            label={
              levelType === 'editor'
                ? t('configTemplate.addMemberDialog.fields.editor.label')
                : t('configTemplate.addMemberDialog.fields.approver.label')
            }
            placeholder={
              levelType === 'editor'
                ? t('configTemplate.addMemberDialog.fields.editor.placeholder')
                : t('configTemplate.addMemberDialog.fields.approver.placeholder')
            }
            selectedLabel={
              selectedUserId
                ? t('configTemplate.addMemberDialog.fields.selected')
                : ''
            }
            emptyLabel={
              levelType === 'editor'
                ? t('configTemplate.addMemberDialog.fields.editor.empty')
                : t('configTemplate.addMemberDialog.fields.approver.empty')
            }
            loadingLabel={
              levelType === 'editor'
                ? t('configTemplate.addMemberDialog.fields.editor.loading')
                : t('configTemplate.addMemberDialog.fields.approver.loading')
            }
            users={availableUsers}
            isLoading={isLoading}
            selectedIds={selectedUserId ? [selectedUserId] : []}
            onToggle={handleToggle}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('configTemplate.addMemberDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={!selectedUserId}>
              {t('configTemplate.addMemberDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
