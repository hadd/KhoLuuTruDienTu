import React, { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateGroup } from '../queries'
import { UserMultiSelectField } from './UserMultiSelectField'

const EDITOR_ROLE_ID = 'editor'
const QC_ROLE_ID = 'qc'

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { t } = useTranslation('group')
  const { mutate: createGroup, isPending } = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [roundNumber, setRoundNumber] = useState<number | string>('')
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

  const handleResetForm = () => {
    setName('')
    setDescription('')
    setRoundNumber('')
    setSelectedEditorIds([])
    setSelectedQcIds([])
  }

  const handleToggleEditor = (userId: string) => {
    setSelectedEditorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleToggleQc = (userId: string) => {
    setSelectedQcIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const parsedRound = Number(roundNumber)
    if (!Number.isFinite(parsedRound) || parsedRound < 1) {
      toast.error(t('createDialog.validation.roundNumberRequired'))
      return
    }
    if (selectedEditorIds.length === 0) {
      toast.error(t('createDialog.validation.editorsRequired'))
      return
    }
    if (selectedQcIds.length === 0) {
      toast.error(t('createDialog.validation.qcRequired'))
      return
    }

    createGroup(
      {
        name: name.trim(),
        description: description.trim(),
        roundNumber: parsedRound,
        editorIds: selectedEditorIds,
        qcIds: selectedQcIds,
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-group-name">{t('createDialog.fields.name.label')}</Label>
            <Input
              id="create-group-name"
              placeholder={t('createDialog.fields.name.placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-group-desc">{t('createDialog.fields.description.label')}</Label>
            <Input
              id="create-group-desc"
              placeholder={t('createDialog.fields.description.placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-group-round">{t('createDialog.fields.roundNumber.label')}</Label>
            <Input
              id="create-group-round"
              type="number"
              placeholder={t('createDialog.fields.roundNumber.placeholder')}
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
              min={1}
              required
              disabled={isPending}
            />
          </div>

          <UserMultiSelectField
            label={t('createDialog.fields.editors.label')}
            placeholder={t('createDialog.fields.editors.placeholder')}
            selectedLabel={t('createDialog.fields.editors.selected', {
              count: selectedEditorIds.length,
            })}
            emptyLabel={t('createDialog.fields.editors.empty')}
            loadingLabel={t('createDialog.fields.editors.loading')}
            users={editors}
            isLoading={isLoadingEditors}
            selectedIds={selectedEditorIds}
            onToggle={handleToggleEditor}
            disabled={isPending}
          />

          <UserMultiSelectField
            label={t('createDialog.fields.qc.label')}
            placeholder={t('createDialog.fields.qc.placeholder')}
            selectedLabel={t('createDialog.fields.qc.selected', { count: selectedQcIds.length })}
            emptyLabel={t('createDialog.fields.qc.empty')}
            loadingLabel={t('createDialog.fields.qc.loading')}
            users={qcUsers}
            isLoading={isLoadingQc}
            selectedIds={selectedQcIds}
            onToggle={handleToggleQc}
            disabled={isPending}
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
              {t('createDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('createDialog.actions.submitting') : t('createDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
