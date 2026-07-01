import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { mapAvailableEditorToUser } from '@/features/group/lib/availableEditors'
import { adminUsersByRoleQueryOptions } from '@/features/user/queries'

import { availableEditorsQueryOptions, useCreateGroup } from '../queries'
import { UserMultiSelectField } from './UserMultiSelectField'

const QC_ROLE_ID = 'qc'
const MAX_APPROVAL_LEVELS = 5
const APPROVAL_LEVEL_OPTIONS = Array.from(
  { length: MAX_APPROVAL_LEVELS + 1 },
  (_, index) => index,
)

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function CreateGroupDialog({
  open,
  onOpenChange,
}: CreateGroupDialogProps) {
  const { t } = useTranslation('group')
  const { mutate: createGroup, isPending } = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [roundNumber, setRoundNumber] = useState<string>('0')
  const [selectedEditorIds, setSelectedEditorIds] = useState<Array<string>>([])
  const [qcLevelUserIds, setQcLevelUserIds] = useState<Array<Array<string>>>([])
  const [leaderId, setLeaderId] = useState<string>('')

  const parsedRoundNumber = Number(roundNumber)
  const usesLeaderOnly =
    Number.isFinite(parsedRoundNumber) && parsedRoundNumber === 0

  const { data: availableEditorsData, isLoading: isLoadingEditors } = useQuery({
    ...availableEditorsQueryOptions(),
    enabled: open,
  })

  const { data: qcData, isLoading: isLoadingQc } = useQuery({
    ...adminUsersByRoleQueryOptions(QC_ROLE_ID),
    enabled: open,
  })

  const editors = useMemo(
    () => (availableEditorsData?.items ?? []).map(mapAvailableEditorToUser),
    [availableEditorsData?.items],
  )
  const qcUsers = qcData?.items ?? []

  useEffect(() => {
    if (!Number.isFinite(parsedRoundNumber) || parsedRoundNumber < 0) return

    setQcLevelUserIds((prev) => {
      if (parsedRoundNumber === 0) return []
      if (prev.length === parsedRoundNumber) return prev

      const next = [...prev]
      while (next.length < parsedRoundNumber) next.push([])
      return next.slice(0, parsedRoundNumber)
    })
  }, [parsedRoundNumber])

  const handleResetForm = () => {
    setName('')
    setDescription('')
    setProjectCode('')
    setRoundNumber('0')
    setSelectedEditorIds([])
    setQcLevelUserIds([])
    setLeaderId('')
  }

  const handleToggleEditor = (userId: string) => {
    setSelectedEditorIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  const handleToggleQcLevelUser = (levelIndex: number, userId: string) => {
    setQcLevelUserIds((prev) =>
      prev.map((levelUserIds, index) => {
        if (index !== levelIndex) return levelUserIds
        return levelUserIds.includes(userId)
          ? levelUserIds.filter((id) => id !== userId)
          : [...levelUserIds, userId]
      }),
    )
  }

  const handleToggleLeader = (userId: string) => {
    setLeaderId((prev) => (prev === userId ? '' : userId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !Number.isFinite(parsedRoundNumber) ||
      parsedRoundNumber < 0 ||
      parsedRoundNumber > MAX_APPROVAL_LEVELS
    ) {
      toast.error(t('createDialog.validation.roundNumberRequired'))
      return
    }
    if (!projectCode.trim()) {
      toast.error(t('createDialog.validation.projectRequired'))
      return
    }
    if (selectedEditorIds.length === 0) {
      toast.error(t('createDialog.validation.editorsRequired'))
      return
    }

    if (usesLeaderOnly) {
      if (!leaderId) {
        toast.error(t('createDialog.validation.leaderRequired'))
        return
      }
    } else {
      const hasEmptyLevel = qcLevelUserIds.some(
        (userIds) => userIds.length === 0,
      )
      if (hasEmptyLevel) {
        toast.error(t('createDialog.validation.qcLevelsRequired'))
        return
      }
    }

    createGroup(
      {
        name: name.trim(),
        description: description.trim(),
        projectCode: projectCode.trim(),
        roundNumber: parsedRoundNumber,
        editorIds: selectedEditorIds,
        qcLevels: qcLevelUserIds.map((userIds) => ({ userIds })),
        ...(usesLeaderOnly && leaderId ? { leaderId } : {}),
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
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[520px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-2"
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="space-y-2">
              <Label htmlFor="create-group-name">
                {t('createDialog.fields.name.label')}
              </Label>
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
              <Label htmlFor="create-group-desc">
                {t('createDialog.fields.description.label')}
              </Label>
              <Input
                id="create-group-desc"
                placeholder={t('createDialog.fields.description.placeholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-group-project">
                  {t('createDialog.fields.project.label')}
                </Label>
                <ProjectSelect
                  value={projectCode}
                  onValueChange={setProjectCode}
                  enabled={open}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-group-round">
                  {t('createDialog.fields.roundNumber.label')}
                </Label>
                <Select
                  value={roundNumber}
                  onValueChange={setRoundNumber}
                  disabled={isPending}
                >
                  <SelectTrigger id="create-group-round">
                    <SelectValue
                      placeholder={t(
                        'createDialog.fields.roundNumber.placeholder',
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVAL_LEVEL_OPTIONS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {t('createDialog.fields.roundNumber.option', { level })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

            {usesLeaderOnly ? (
              <UserMultiSelectField
                label={t('createDialog.fields.leader.label')}
                placeholder={t('createDialog.fields.leader.placeholder')}
                selectedLabel={t('createDialog.fields.leader.selected')}
                emptyLabel={t('createDialog.fields.leader.empty')}
                loadingLabel={t('createDialog.fields.leader.loading')}
                users={qcUsers}
                isLoading={isLoadingQc}
                selectedIds={leaderId ? [leaderId] : []}
                onToggle={handleToggleLeader}
                disabled={isPending}
                hint={t('createDialog.fields.leader.hint')}
              />
            ) : (
              qcLevelUserIds.map((levelUserIds, index) => (
                <UserMultiSelectField
                  key={`qc-level-${index + 1}`}
                  label={t('createDialog.fields.qcLevel.label', {
                    level: index + 1,
                  })}
                  placeholder={t('createDialog.fields.qcLevel.placeholder')}
                  selectedLabel={t('createDialog.fields.qcLevel.selected', {
                    count: levelUserIds.length,
                  })}
                  emptyLabel={t('createDialog.fields.qcLevel.empty')}
                  loadingLabel={t('createDialog.fields.qcLevel.loading')}
                  users={qcUsers}
                  isLoading={isLoadingQc}
                  selectedIds={levelUserIds}
                  onToggle={(userId) => handleToggleQcLevelUser(index, userId)}
                  disabled={isPending}
                />
              ))
            )}
          </div>

          <DialogFooter className="shrink-0 pt-2">
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
              {isPending
                ? t('createDialog.actions.submitting')
                : t('createDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
