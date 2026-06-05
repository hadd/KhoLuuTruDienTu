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
import { useUpdateGroup } from '../queries'
import type { AddMemberDialogProps } from '../types'
import { UserMultiSelectField } from './UserMultiSelectField'

const EDITOR_ROLE_ID = 'editor'
const QC_ROLE_ID = 'qc'

export function AddMemberDialog({ open, onOpenChange, group }: AddMemberDialogProps) {
  const { t } = useTranslation('group')
  const { mutate: updateGroup, isPending } = useUpdateGroup()

  const [selectedEditorIds, setSelectedEditorIds] = useState<Array<string>>([])
  const [selectedQcIds, setSelectedQcIds] = useState<Array<string>>([])

  const { data: editorsData, isLoading: isLoadingEditors } = useQuery({
    ...adminUsersByRoleQueryOptions(EDITOR_ROLE_ID),
    enabled: open,
  })

  const { data: qcData, isLoading: isLoadingQc } = useQuery({
    ...adminUsersByRoleQueryOptions(QC_ROLE_ID),
    enabled: open,
  })

  const editors = editorsData?.items ?? []
  const qcUsers = qcData?.items ?? []

  useEffect(() => {
    if (open && group) {
      setSelectedEditorIds(group.editorUserIds)
      setSelectedQcIds(group.qcUserIds)
    }
  }, [open, group])

  const handleResetForm = () => {
    setSelectedEditorIds([])
    setSelectedQcIds([])
  }

  const handleToggleEditor = (userId: string) => {
    setSelectedEditorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!group) return

    if (selectedEditorIds.length === 0) {
      toast.error(t('addMemberDialog.validation.editorsRequired'))
      return
    }

    const hasQcChanges =
      selectedQcIds.length !== group.qcUserIds.length ||
      selectedQcIds.some((id) => !group.qcUserIds.includes(id))

    if (hasQcChanges) {
      toast.error(t('addMemberDialog.validation.qcNotSupported'))
      return
    }

    updateGroup(
      {
        id: group.id,
        payload: {
          name: group.name,
          description: group.description,
          editorIds: selectedEditorIds,
        },
      },
      {
        onSuccess: () => {
          handleResetForm()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) handleResetForm()
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('addMemberDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('addMemberDialog.description', { name: group?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <UserMultiSelectField
            label={t('addMemberDialog.fields.editors.label')}
            placeholder={t('addMemberDialog.fields.editors.placeholder')}
            selectedLabel={t('addMemberDialog.fields.editors.selected', {
              count: selectedEditorIds.length,
            })}
            emptyLabel={t('addMemberDialog.fields.editors.empty')}
            loadingLabel={t('addMemberDialog.fields.editors.loading')}
            users={editors}
            isLoading={isLoadingEditors}
            selectedIds={selectedEditorIds}
            onToggle={handleToggleEditor}
            disabled={isPending}
          />

          <UserMultiSelectField
            label={t('addMemberDialog.fields.qc.label')}
            placeholder={t('addMemberDialog.fields.qc.placeholder')}
            selectedLabel={t('addMemberDialog.fields.qc.selected', {
              count: selectedQcIds.length,
            })}
            emptyLabel={t('addMemberDialog.fields.qc.empty')}
            loadingLabel={t('addMemberDialog.fields.qc.loading')}
            users={qcUsers}
            isLoading={isLoadingQc}
            selectedIds={selectedQcIds}
            onToggle={() => undefined}
            disabled={isPending}
            readOnly
            hint={t('addMemberDialog.fields.qc.comingSoon')}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                handleResetForm()
              }}
              disabled={isPending}
            >
              {t('addMemberDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('addMemberDialog.actions.submitting')
                : t('addMemberDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
