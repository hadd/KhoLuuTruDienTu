import { FilePlus, Loader2, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { adminUsersByRoleQueryOptions } from '@/features/user/queries'
import { buildQcAndAdminUsersList } from '@/features/group/lib/availableEditors'
import { buildUpdateGroupPayload, getLeaderUserIdFromGroup, getQcLevelUserIdsFromGroup } from '@/features/group/lib/groupPayload'
import { buildQcLevelsDisplay } from '@/features/group/lib/qcLevels'
import { useUpdateGroup } from '@/features/group/queries'
import { groupConfigStore, useGroupConfig } from '@/features/group/store'

import type { Group, GroupQcMemberT, Member } from '../types'
import { AddApproverDialog } from './AddApproverDialog'
import { AssignFolderDialog } from './AssignFolderDialog'
import { ApprovalRoundStepper } from './ApprovalRoundStepper'
import { GroupApproverLevelsView } from './GroupApproverLevelsView'
import { GroupConfigTemplateSelect } from './GroupConfigTemplateSelect'
import { GroupDefaultMembersView } from './GroupDefaultMembersView'
import { GroupPermissionSlotsView } from './GroupPermissionSlotsView'

const QC_ROLE_ID = 'qc'
const ADMIN_ROLE_ID = 'admin'

interface GroupCardProps {
  group: Group
  isEdited: boolean
  isSelected: boolean
  editMembersGroupId: string | null
  setEditMembersGroupId: (value: string | null) => void
  handleEditSave: (groupId: string) => void
  setSelectedGroup: (group: Group) => void
  setAddMemberOpen: (open: boolean) => void
  setDeleteOpen: (open: boolean) => void
  setSelectedMember: (member: Member) => void
  setMemberProfileOpen: (open: boolean) => void
  setMemberToRemove: (payload: { groupId: string; member: Member } | null) => void
}

export function GroupCard({
  group,
  isEdited,
  isSelected,
  editMembersGroupId,
  setEditMembersGroupId,
  handleEditSave,
  setSelectedGroup,
  setAddMemberOpen,
  setDeleteOpen,
  setSelectedMember,
  setMemberProfileOpen,
  setMemberToRemove,
}: GroupCardProps) {
  const { t } = useTranslation('group')
  const { useMetadataPermissionConfig, metadataPermissionConfigId } = useGroupConfig(group.id)
  const canManageMembers =
    useMetadataPermissionConfig && Boolean(metadataPermissionConfigId)
  const { mutateAsync: updateGroup, isPending: isUpdatingGroup } = useUpdateGroup()
  const [editName, setEditName] = useState(group.name)
  const [editDescription, setEditDescription] = useState(group.description || '')
  const [editRoundNumber, setEditRoundNumber] = useState(group.roundNumber ?? 0)
  const [editQcLevelUserIds, setEditQcLevelUserIds] = useState<Array<Array<string>>>([])
  const [addApproverOpen, setAddApproverOpen] = useState(false)
  const [addApproverLevel, setAddApproverLevel] = useState<number | null>(null)
  const [dossiersPerEditor, setDossiersPerEditor] = useState(group.dossiersPerEditor ?? 1)
  const [dossiersInput, setDossiersInput] = useState(String(group.dossiersPerEditor ?? 1))
  const [assignFolderOpen, setAssignFolderOpen] = useState(false)

  useEffect(() => {
    const value = group.dossiersPerEditor ?? 1
    setDossiersPerEditor(value)
    setDossiersInput(String(value))
  }, [group.dossiersPerEditor])

  useEffect(() => {
    groupConfigStore.initFromGroup(group.id, {
      metadataPermissionConfigId: group.metadataPermissionConfigId,
      metadataTemplateId: group.permissionConfig?.templateId,
    })
  }, [group.id, group.metadataPermissionConfigId, group.permissionConfig?.templateId])

  useEffect(() => {
    if (editMembersGroupId !== group.id) return
    const round = group.roundNumber ?? 0
    const fromGroup = getQcLevelUserIdsFromGroup(group)
    const padded = [...fromGroup]
    while (padded.length < round) padded.push([])
    setEditName(group.name)
    setEditDescription(group.description || '')
    setEditRoundNumber(round)
    setEditQcLevelUserIds(padded.slice(0, round))
  }, [editMembersGroupId, group.id, group.name, group.description, group.roundNumber, group.qcLevels])

  const isEditing = editMembersGroupId === group.id
  const displayRoundNumber = group.roundNumber ?? 0

  useEffect(() => {
    if (!isEditing) return
    setEditQcLevelUserIds((prev) => {
      if (editRoundNumber === 0) return []
      if (prev.length === editRoundNumber) return prev
      const next = [...prev]
      while (next.length < editRoundNumber) next.push([])
      return next.slice(0, editRoundNumber)
    })
  }, [editRoundNumber, isEditing])

  const { data: qcData, isLoading: isLoadingQc } = useQuery({
    ...adminUsersByRoleQueryOptions(QC_ROLE_ID),
    enabled: isEditing || canManageMembers,
  })

  const { data: adminData, isLoading: isLoadingAdmin } = useQuery({
    ...adminUsersByRoleQueryOptions(ADMIN_ROLE_ID),
    enabled: isEditing || canManageMembers,
  })

  const approverUsers = useMemo(
    () =>
      buildQcAndAdminUsersList(
        qcData?.items ?? [],
        adminData?.items ?? [],
        group,
      ),
    [qcData?.items, adminData?.items, group],
  )

  const displayQcLevels = useMemo(() => {
    if (!isEditing) return group.qcLevels
    return buildQcLevelsDisplay(editQcLevelUserIds, group, approverUsers)
  }, [isEditing, editQcLevelUserIds, group, approverUsers])

  const buildQcLevelsPayload = (levelUserIds: Array<Array<string>>, roundNumber: number) => {
    const paddedLevels = [...levelUserIds]
    while (paddedLevels.length < roundNumber) {
      paddedLevels.push([])
    }

    const slicedLevels = paddedLevels.slice(0, roundNumber)

    return {
      qcLevels: roundNumber === 0 ? [] : slicedLevels.map((userIds) => ({ userIds })),
      roundNumber,
    }
  }

  const persistQcLevels = async (levelUserIds: Array<Array<string>>) => {
    const roundNumber = group.roundNumber ?? levelUserIds.length
    await updateGroup({
      id: group.id,
      payload: buildUpdateGroupPayload(group, {
        ...buildQcLevelsPayload(levelUserIds, roundNumber),
      }),
    })
  }

  const handleRemoveQcMember = (level: number, member: GroupQcMemberT) => {
    const applyRemove = (prev: Array<Array<string>>) =>
      prev.map((userIds, index) =>
        index === level - 1
          ? userIds.filter((userId) => userId !== member.userId)
          : userIds,
      )

    if (isEditing) {
      setEditQcLevelUserIds(applyRemove)
      return
    }

    if (!canManageMembers) return

    void persistQcLevels(applyRemove(getQcLevelUserIdsFromGroup(group)))
  }

  const handleRemoveQcLevel = (level: number) => {
    if (!isEditing) return
    setEditQcLevelUserIds((prev) => prev.filter((_, index) => index !== level - 1))
    setEditRoundNumber((prev) => Math.max(0, prev - 1))
  }

  const handleOpenAddApprover = (level: number) => {
    setAddApproverLevel(level)
    setAddApproverOpen(true)
  }

  const handleSubmitApprovers = (userIds: Array<string>) => {
    if (addApproverLevel === null) return
    const levelIndex = addApproverLevel - 1

    const baseLevelUserIds = isEditing
      ? editQcLevelUserIds
      : getQcLevelUserIdsFromGroup(group)

    const nextLevelUserIds = baseLevelUserIds.map((existingIds, index) =>
      index === levelIndex ? userIds : existingIds,
    )

    if (isEditing) {
      setEditQcLevelUserIds(nextLevelUserIds)
      return
    }

    if (!canManageMembers) return

    void persistQcLevels(nextLevelUserIds)
  }

  const addApproverExistingIds =
    addApproverLevel !== null
      ? (isEditing
          ? (editQcLevelUserIds[addApproverLevel - 1] ?? [])
          : (getQcLevelUserIdsFromGroup(group)[addApproverLevel - 1] ?? []))
      : []

  const handleToggleEdit = () => {
    if (isEditing) {
      setEditMembersGroupId(null)
      return
    }
    setEditMembersGroupId(group.id)
  }

  const handleSaveNameDescription = async () => {
    const trimmedName = editName.trim()
    if (!trimmedName) return

    if (editRoundNumber === 0 && !getLeaderUserIdFromGroup(group)) {
      toast.error(t('addMemberDialog.validation.leaderRequired'))
      return
    }

    if (editRoundNumber > 0) {
      const hasEmptyLevel = editQcLevelUserIds.some((userIds) => userIds.length === 0)
      if (hasEmptyLevel) {
        toast.error(t('addMemberDialog.validation.qcLevelsRequired'))
        return
      }
    }

    try {
      await updateGroup({
        id: group.id,
        payload: buildUpdateGroupPayload(group, {
          name: trimmedName,
          description: editDescription.trim(),
          ...buildQcLevelsPayload(editQcLevelUserIds, editRoundNumber),
        }),
      })
      handleEditSave(group.id)
      setEditMembersGroupId(null)
    } catch {
      // Error toast handled in mutation
    }
  }

  return (
    <Card
      className={`relative flex h-full min-h-0 flex-col overflow-hidden transition-colors ${
        isEdited ? 'border-green-500 ring-2 ring-green-500 bg-green-500/5' :
        isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-border/80'
      }`}
    >
      <CardFooter className="shrink-0 border-b bg-muted/20 px-4 py-3 flex flex-col lg:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {isEditing ? (
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="h-8 max-w-sm font-semibold text-lg"
                  placeholder={t('card.fields.namePlaceholder')}
                />
                <ApprovalRoundStepper
                  value={editRoundNumber}
                  isEditing
                  disabled={isUpdatingGroup}
                  onChange={setEditRoundNumber}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className="h-8 text-sm flex-1 min-w-[220px]"
                  placeholder={t('card.fields.descriptionPlaceholder')}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={isUpdatingGroup || !editName.trim()}
                  onClick={() => void handleSaveNameDescription()}
                >
                  {isUpdatingGroup ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    t('card.actions.save')
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  disabled={isUpdatingGroup}
                  onClick={() => setEditMembersGroupId(null)}
                >
                  {t('card.actions.cancel')}
                </Button>
              </div>
              {useMetadataPermissionConfig ? (
                <GroupConfigTemplateSelect
                  groupId={group.id}
                  permissionConfig={group.permissionConfig}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-lg font-semibold line-clamp-1">{group.name}</span>
                    <ApprovalRoundStepper value={displayRoundNumber} />
                  </div>
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {group.description || t('card.noDescription')}
                  </span>
                </div>

                <div
                  className="rounded-md border bg-muted/5 px-3 py-2 text-sm flex items-center"
                  title={t('card.limitsHint')}
                >
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-[10px] uppercase whitespace-nowrap">
                      {t('distributedDossiers')}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={dossiersInput}
                      onChange={(event) => {
                        const raw = event.target.value
                        if (/^\d*$/.test(raw)) {
                          setDossiersInput(raw)
                          const parsed = Number(raw)
                          if (raw !== '' && parsed >= 1) {
                            setDossiersPerEditor(parsed)
                          }
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number(dossiersInput)
                        if (!parsed || parsed < 1) {
                          setDossiersInput('1')
                          setDossiersPerEditor(1)
                          return
                        }
                        setDossiersInput(String(parsed))
                        setDossiersPerEditor(parsed)
                      }}
                      className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-20 p-0 m-0 h-5 mt-1"
                    />
                  </div>
                </div>
              </div>

              <GroupConfigTemplateSelect
                groupId={group.id}
                permissionConfig={group.permissionConfig}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => {
                      setSelectedGroup(group)
                      setAddMemberOpen(true)
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('card.actions.addMember')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isEditing ? 'bg-accent text-foreground' : 'text-foreground'}`}
                    onClick={handleToggleEdit}
                    aria-label={t('card.actions.editGroup')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('card.actions.editGroup')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedGroup(group)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('card.actions.deleteGroup')}</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-blue-600 hover:bg-blue-600/10 hover:text-blue-700 px-2"
                onClick={() => setAssignFolderOpen(true)}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                {t('assignTasks')}
              </Button>
            </div>
          </TooltipProvider>
        </div>
      </CardFooter>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pt-4">
        {useMetadataPermissionConfig ? (
          <>
            <GroupPermissionSlotsView group={group} isEditing={isEditing} />

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('configTemplate.sections.approver')}
              </div>
              <GroupApproverLevelsView
                group={group}
                levels={displayQcLevels}
                isEditing={isEditing}
                canManageMembers={canManageMembers}
                onRemoveMember={handleRemoveQcMember}
                onRemoveLevel={handleRemoveQcLevel}
                onAddApprovers={handleOpenAddApprover}
              />
            </div>
          </>
        ) : (
          <GroupDefaultMembersView
            group={group}
            isEditing={isEditing}
            displayQcLevels={displayQcLevels}
            setSelectedMember={setSelectedMember}
            setMemberProfileOpen={setMemberProfileOpen}
            setMemberToRemove={setMemberToRemove}
            onRemoveApprover={handleRemoveQcMember}
            onRemoveApprovalLevel={handleRemoveQcLevel}
            onAddApprovers={handleOpenAddApprover}
          />
        )}
      </CardContent>

      <AssignFolderDialog
        open={assignFolderOpen}
        onOpenChange={setAssignFolderOpen}
        group={group}
        dossiersPerEditor={dossiersPerEditor}
      />

      <AddApproverDialog
        open={addApproverOpen}
        onOpenChange={setAddApproverOpen}
        level={addApproverLevel ?? 1}
        users={approverUsers}
        isLoading={isLoadingQc || isLoadingAdmin}
        existingUserIds={addApproverExistingIds}
        onSubmit={handleSubmitApprovers}
      />
    </Card>
  )
}
