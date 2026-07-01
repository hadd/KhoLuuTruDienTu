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
import type { GroupZoneMemberT } from '@/features/group/types'

import { UserMultiSelectField } from './UserMultiSelectField'

interface AddSlotEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotName: string
  availableEditors: Array<GroupZoneMemberT>
  excludedMemberIds: Array<string>
  onSubmit: (members: Array<GroupZoneMemberT>) => void
}

export function AddSlotEditorDialog({
  open,
  onOpenChange,
  slotName,
  availableEditors,
  excludedMemberIds,
  onSubmit,
}: AddSlotEditorDialogProps) {
  const { t } = useTranslation('group')
  const [selectedUserIds, setSelectedUserIds] = useState<Array<string>>([])

  const excludedSet = new Set(excludedMemberIds)
  const selectableEditors = availableEditors.filter(
    (editor) => !excludedSet.has(editor.userId),
  )

  useEffect(() => {
    if (open) {
      setSelectedUserIds([])
    }
  }, [open, slotName])

  const handleToggle = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedUserIds.length === 0) return

    const editors = selectableEditors.filter((item) =>
      selectedUserIds.includes(item.userId),
    )
    if (editors.length === 0) return

    onSubmit(editors)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[480px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('configTemplate.addMemberDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('configTemplate.addMemberDialog.description', {
              level: slotName,
            })}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-2"
            onWheel={(event) => event.stopPropagation()}
          >
            <UserMultiSelectField
              label={t('configTemplate.addMemberDialog.fields.editor.label')}
              placeholder={t(
                'configTemplate.addMemberDialog.fields.editor.placeholder',
              )}
              selectedLabel={
                selectedUserIds.length > 0
                  ? t('configTemplate.addMemberDialog.fields.selectedCount', {
                      count: selectedUserIds.length,
                    })
                  : ''
              }
              emptyLabel={t(
                'configTemplate.addMemberDialog.fields.editor.empty',
              )}
              loadingLabel={t(
                'configTemplate.addMemberDialog.fields.editor.loading',
              )}
              users={selectableEditors.map((editor) => ({
                id: editor.userId,
                fullName: editor.fullName,
                email: editor.email,
              }))}
              isLoading={false}
              selectedIds={selectedUserIds}
              onToggle={handleToggle}
            />
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('configTemplate.addMemberDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={selectedUserIds.length === 0}>
              {t('configTemplate.addMemberDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
