import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import {
  buildAvailableEditorsNotInGroup,
  buildEditorUsersList,
  buildQcUsersList,
} from '@/features/group/lib/availableEditors'
import {
  buildUpdateGroupPayload,
  getLeaderUserIdFromGroup,
  getQcLevelUserIdsFromGroup,
  MAX_APPROVAL_LEVELS,
} from '@/features/group/lib/groupPayload'
import { DATA_ENTRY_CHECKER_PERMISSION } from '@/features/data-management/lib/resolveDataManagementRole'
import { adminUsersByPermissionQueryOptions } from '@/features/user/queries'

import { availableEditorsQueryOptions, useUpdateGroup } from '../queries'
import type { AddMemberDialogProps } from '../types'
import { UserMultiSelectField } from './UserMultiSelectField'

export function AddMemberDialog({
  open,
  onOpenChange,
  group,
  mode = 'add',
}: AddMemberDialogProps) {
  const isEditMode = mode === 'edit'
  const { t } = useTranslation('group')
  const { mutate: updateGroup, isPending } = useUpdateGroup()

  const [selectedEditorIds, setSelectedEditorIds] = useState<Array<string>>([])
  const [newEditorIds, setNewEditorIds] = useState<Array<string>>([])
  const [qcLevelUserIds, setQcLevelUserIds] = useState<Array<Array<string>>>([])
  const [leaderId, setLeaderId] = useState<string>('')

  const usesLeaderOnly = isEditMode && qcLevelUserIds.length === 0

  const { data: availableEditorsData, isLoading: isLoadingEditors } = useQuery({
    ...availableEditorsQueryOptions(),
    enabled: open,
  })

  const { data: qcData, isLoading: isLoadingQc } = useQuery({
    ...adminUsersByPermissionQueryOptions(DATA_ENTRY_CHECKER_PERMISSION),
    enabled: open && isEditMode,
  })

  const availableItems = availableEditorsData?.items ?? []

  const editors = useMemo(
    () =>
      isEditMode
        ? buildEditorUsersList(availableItems, group)
        : buildAvailableEditorsNotInGroup(availableItems, group),
    [availableItems, group, isEditMode],
  )

  const qcUsers = useMemo(
    () => buildQcUsersList(qcData?.items ?? [], group),
    [qcData?.items, group],
  )

  useEffect(() => {
    if (!open || !group) return

    if (isEditMode) {
      setSelectedEditorIds(group.editorUserIds)
      setQcLevelUserIds(getQcLevelUserIdsFromGroup(group))
      setLeaderId(getLeaderUserIdFromGroup(group))
    } else {
      setNewEditorIds([])
    }
  }, [open, group, isEditMode])

  const handleResetForm = () => {
    setSelectedEditorIds([])
    setNewEditorIds([])
    setQcLevelUserIds([])
    setLeaderId('')
  }

  const handleToggleEditor = (userId: string) => {
    if (isEditMode) {
      setSelectedEditorIds((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId],
      )
      return
    }

    setNewEditorIds((prev) =>
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

  const handleAddApprovalLevel = () => {
    setQcLevelUserIds((prev) => {
      if (prev.length >= MAX_APPROVAL_LEVELS) return prev
      return [...prev, []]
    })
  }

  const handleRemoveApprovalLevel = (levelIndex: number) => {
    setQcLevelUserIds((prev) => prev.filter((_, index) => index !== levelIndex))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!group) return

    if (isEditMode) {
      if (selectedEditorIds.length === 0) {
        toast.error(t('addMemberDialog.validation.editorsRequired'))
        return
      }

      if (usesLeaderOnly) {
        if (!leaderId) {
          toast.error(t('addMemberDialog.validation.leaderRequired'))
          return
        }
      } else {
        const hasEmptyLevel = qcLevelUserIds.some(
          (userIds) => userIds.length === 0,
        )
        if (hasEmptyLevel) {
          toast.error(t('addMemberDialog.validation.qcLevelsRequired'))
          return
        }
      }

      const roundNumber = usesLeaderOnly ? 0 : qcLevelUserIds.length

      updateGroup(
        {
          id: group.id,
          payload: buildUpdateGroupPayload(group, {
            roundNumber,
            editorIds: selectedEditorIds,
            qcLevels: usesLeaderOnly
              ? []
              : qcLevelUserIds.map((userIds) => ({ userIds })),
            ...(usesLeaderOnly && leaderId ? { leaderId } : {}),
          }),
        },
        {
          onSuccess: () => {
            handleResetForm()
            onOpenChange(false)
          },
        },
      )
      return
    }

    if (newEditorIds.length === 0) {
      toast.error(t('addMemberDialog.validation.addEditorsRequired'))
      return
    }

    const mergedEditorIds = [
      ...new Set([...group.editorUserIds, ...newEditorIds]),
    ]

    updateGroup(
      {
        id: group.id,
        payload: buildUpdateGroupPayload(group, {
          editorIds: mergedEditorIds,
        }),
      },
      {
        onSuccess: () => {
          handleResetForm()
          onOpenChange(false)
        },
      },
    )
  }

  const editorSelectedIds = isEditMode ? selectedEditorIds : newEditorIds

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
          <DialogTitle>
            {isEditMode
              ? t('editMembersDialog.title')
              : t('addMemberDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('editMembersDialog.description', { name: group?.name ?? '' })
              : t('addMemberDialog.description', { name: group?.name ?? '' })}
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
              label={t('addMemberDialog.fields.editors.label')}
              placeholder={t('addMemberDialog.fields.editors.placeholder')}
              selectedLabel={t('addMemberDialog.fields.editors.selected', {
                count: editorSelectedIds.length,
              })}
              emptyLabel={t('addMemberDialog.fields.editors.empty')}
              loadingLabel={t('addMemberDialog.fields.editors.loading')}
              users={editors}
              isLoading={isLoadingEditors}
              selectedIds={editorSelectedIds}
              onToggle={handleToggleEditor}
              disabled={isPending}
              hint={
                isEditMode
                  ? t('editMembersDialog.fields.editors.hint')
                  : undefined
              }
            />

            {isEditMode && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t('addMemberDialog.fields.approvalLevels.title', {
                      count: qcLevelUserIds.length,
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={
                      isPending || qcLevelUserIds.length >= MAX_APPROVAL_LEVELS
                    }
                    onClick={handleAddApprovalLevel}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('addMemberDialog.fields.approvalLevels.addLevel')}
                  </Button>
                </div>

                {usesLeaderOnly ? (
                  <UserMultiSelectField
                    label={t('addMemberDialog.fields.leader.label')}
                    placeholder={t('addMemberDialog.fields.leader.placeholder')}
                    selectedLabel={t('addMemberDialog.fields.leader.selected')}
                    emptyLabel={t('addMemberDialog.fields.leader.empty')}
                    loadingLabel={t('addMemberDialog.fields.leader.loading')}
                    users={qcUsers}
                    isLoading={isLoadingQc}
                    selectedIds={leaderId ? [leaderId] : []}
                    onToggle={handleToggleLeader}
                    disabled={isPending}
                    hint={t('addMemberDialog.fields.leader.hint')}
                  />
                ) : (
                  qcLevelUserIds.map((levelUserIds, index) => (
                    <div
                      key={`edit-qc-level-${index + 1}`}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {t('addMemberDialog.fields.qcLevel.label', {
                            level: index + 1,
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={isPending}
                          onClick={() => handleRemoveApprovalLevel(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t(
                            'addMemberDialog.fields.approvalLevels.removeLevel',
                          )}
                        </Button>
                      </div>
                      <UserMultiSelectField
                        label={t('addMemberDialog.fields.qcLevel.selectLabel')}
                        placeholder={t(
                          'addMemberDialog.fields.qcLevel.placeholder',
                        )}
                        selectedLabel={t(
                          'addMemberDialog.fields.qcLevel.selected',
                          {
                            count: levelUserIds.length,
                          },
                        )}
                        emptyLabel={t('addMemberDialog.fields.qcLevel.empty')}
                        loadingLabel={t(
                          'addMemberDialog.fields.qcLevel.loading',
                        )}
                        users={qcUsers}
                        isLoading={isLoadingQc}
                        selectedIds={levelUserIds}
                        onToggle={(userId) =>
                          handleToggleQcLevelUser(index, userId)
                        }
                        disabled={isPending}
                      />
                    </div>
                  ))
                )}
              </div>
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
