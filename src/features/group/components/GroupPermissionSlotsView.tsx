import { useQuery } from '@tanstack/react-query'
import { Loader2, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { permissionConfigQueryOptions } from '@/features/data-config/queries'
import { buildSlotAssignmentsFromGroup } from '@/features/group/lib/mapAdminGroup'
import { getLevelGridClass } from '@/features/group/lib/qcLevels'
import {
  useAssignGroupMetadataPermissionConfig,
  useUpdateGroupPermissionAssignments,
} from '@/features/group/queries'
import { groupConfigStore, useGroupConfig } from '@/features/group/store'
import type { Group, GroupZoneMemberT } from '@/features/group/types'

import { AddSlotEditorDialog } from './AddSlotEditorDialog'

interface GroupPermissionSlotsViewProps {
  group: Group
  isEditing?: boolean
}

export function GroupPermissionSlotsView({
  group,
  isEditing = false,
}: GroupPermissionSlotsViewProps) {
  const { t } = useTranslation('group')
  const { metadataPermissionConfigId, slotAssignmentsBySlotCode } =
    useGroupConfig(group.id)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addTargetSlotCode, setAddTargetSlotCode] = useState<string | null>(
    null,
  )
  const [pendingRemoval, setPendingRemoval] = useState<{
    slotCode: string
    member: GroupZoneMemberT
  } | null>(null)
  const { mutateAsync: saveAssignments, isPending: isSaving } =
    useUpdateGroupPermissionAssignments()
  const { mutateAsync: assignMetadataConfig, isPending: isAssigningConfig } =
    useAssignGroupMetadataPermissionConfig()

  const [isHandling, setIsHandling] = useState(false)

  const availableEditors = useMemo(
    () =>
      group.members
        .filter((member) => member.role === 'member')
        .map(
          (member): GroupZoneMemberT => ({
            userId: member.userId,
            fullName: member.name,
            email: member.email,
          }),
        ),
    [group.members],
  )

  const initialSlotAssignments = useMemo(
    () => buildSlotAssignmentsFromGroup(group),
    [group],
  )

  const serverConfigId =
    group.metadataPermissionConfigId ?? group.permissionConfig?.id ?? null

  useEffect(() => {
    if (metadataPermissionConfigId !== serverConfigId) return
    if (Object.keys(slotAssignmentsBySlotCode).length > 0) return
    if (Object.keys(initialSlotAssignments).length === 0) return

    groupConfigStore.initSlotAssignments(group.id, initialSlotAssignments)
  }, [
    group.id,
    initialSlotAssignments,
    metadataPermissionConfigId,
    serverConfigId,
    slotAssignmentsBySlotCode,
  ])

  const {
    data: selectedPermissionConfig,
    isLoading: isLoadingPermissionConfig,
  } = useQuery({
    ...permissionConfigQueryOptions(metadataPermissionConfigId ?? ''),
    enabled: Boolean(metadataPermissionConfigId),
  })

  const slots = useMemo(() => {
    if (selectedPermissionConfig?.slots) {
      return [...selectedPermissionConfig.slots].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      )
    }

    if (
      group.permissionConfig &&
      metadataPermissionConfigId &&
      group.permissionConfig.id === metadataPermissionConfigId
    ) {
      return [...(group.permissionConfig.slots ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      )
    }

    return []
  }, [
    group.permissionConfig,
    metadataPermissionConfigId,
    selectedPermissionConfig?.slots,
  ])

  const addTargetSlotName =
    slots.find((slot) => slot.slotCode === addTargetSlotCode)?.slotName ?? ''

  const serverSlotAssignments = useMemo(() => {
    if (metadataPermissionConfigId !== serverConfigId) {
      return {} as Record<string, Array<GroupZoneMemberT>>
    }
    return initialSlotAssignments
  }, [initialSlotAssignments, metadataPermissionConfigId, serverConfigId])

  const hasUnsavedChanges = useMemo(() => {
    const toComparable = (
      assignments: Record<string, Array<GroupZoneMemberT>>,
    ) =>
      slots
        .map((slot) => ({
          slotCode: slot.slotCode,
          userIds: [...(assignments[slot.slotCode] ?? []).map((m) => m.userId)].sort(),
        }))
        .sort((left, right) => left.slotCode.localeCompare(right.slotCode))

    return (
      JSON.stringify(toComparable(slotAssignmentsBySlotCode)) !==
      JSON.stringify(toComparable(serverSlotAssignments))
    )
  }, [serverSlotAssignments, slotAssignmentsBySlotCode, slots])

  const persistAssignments = useCallback(
    async (
      nextAssignments: Record<string, Array<GroupZoneMemberT>>,
    ): Promise<boolean> => {
      if (!metadataPermissionConfigId || slots.length === 0) return false

      try {
        if (serverConfigId !== metadataPermissionConfigId) {
          await assignMetadataConfig({
            groupId: group.id,
            permissionConfigId: metadataPermissionConfigId,
          })
        }

        await saveAssignments({
          groupId: group.id,
          payload: {
            assignments: slots.map((slot) => ({
              slotCode: slot.slotCode,
              editorIds: (nextAssignments[slot.slotCode] ?? []).map(
                (member) => member.userId,
              ),
            })),
          },
        })
        return true
      } catch {
        // Mutation onError handlers show toast messages.
        return false
      }
    },
    [
      assignMetadataConfig,
      group.id,
      metadataPermissionConfigId,
      saveAssignments,
      serverConfigId,
      slots,
    ],
  )

  const handleAddMembers = (members: Array<GroupZoneMemberT>) => {
    if (!addTargetSlotCode) return

    for (const member of members) {
      groupConfigStore.addSlotMember(group.id, addTargetSlotCode, member)
    }
  }

  const handleSave = async () => {
    if (isHandling) return
    setIsHandling(true)

    const current = groupConfigStore.getState().configByGroupId[group.id]
    if (!current) return

    try {
      await persistAssignments(current.slotAssignmentsBySlotCode)
    } finally {
      setIsHandling(false)
    }
  }

  const getExcludedMemberIds = () =>
    Object.values(slotAssignmentsBySlotCode).flatMap((members) =>
      members.map((member) => member.userId),
    )

  const handleRequestRemoveMember = (
    slotCode: string,
    member: GroupZoneMemberT,
  ) => {
    setPendingRemoval({ slotCode, member })
  }

  const handleConfirmRemove = () => {
    if (!pendingRemoval) return

    const { slotCode, member } = pendingRemoval
    groupConfigStore.removeSlotMember(group.id, slotCode, member.userId)
    setPendingRemoval(null)
  }

  const pendingRemovalSlotName =
    pendingRemoval !== null
      ? (slots.find((slot) => slot.slotCode === pendingRemoval.slotCode)
          ?.slotName ?? '')
      : ''

  if (!metadataPermissionConfigId) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('permissionAssignments.selectConfigFirst')}
      </p>
    )
  }

  if (isLoadingPermissionConfig) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('permissionAssignments.loading')}
      </p>
    )
  }

  if (slots.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('permissionAssignments.emptySlots')}
      </p>
    )
  }

  const isBusy = isHandling || isSaving || isAssigningConfig
  const canManageMembers = isEditing || Boolean(metadataPermissionConfigId)

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('configTemplate.sections.editor')}
          </div>
          {canManageMembers && (hasUnsavedChanges || isBusy) ? (
            <Button
              size="sm"
              className="h-7 shrink-0 px-3 text-xs"
              disabled={isBusy}
              onClick={handleSave}
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('permissionAssignments.saving')}
                </>
              ) : (
                t('permissionAssignments.save')
              )}
            </Button>
          ) : null}
        </div>

        <div className={getLevelGridClass(slots.length)}>
          {slots.map((slot, index) => {
            const members = slotAssignmentsBySlotCode[slot.slotCode] ?? []

            return (
              <Card
                key={slot.slotCode}
                variant="default"
                className="overflow-hidden bg-card shadow-none"
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {slot.slotName ||
                      t('card.approverLevel', { level: index + 1 })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={isBusy || !canManageMembers}
                    onClick={() => {
                      setAddTargetSlotCode(slot.slotCode)
                      setAddMemberOpen(true)
                    }}
                    aria-label={t('card.actions.addMember')}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="min-h-[56px] px-3 py-3 pt-3">
                  {members.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {members.map((member) => (
                        <div
                          key={`${slot.slotCode}-${member.userId}`}
                          className="group relative"
                        >
                          <Badge
                            variant="secondary"
                            className="py-1 pr-3 font-normal"
                          >
                            {member.fullName}
                          </Badge>
                          {canManageMembers ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleRequestRemoveMember(slot.slotCode, member)
                              }
                              className="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity hover:bg-destructive/80 group-hover:opacity-100"
                              aria-label={t('configTemplate.zone.removeMember')}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      {t('configTemplate.zone.empty')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {addMemberOpen && addTargetSlotCode ? (
        <AddSlotEditorDialog
          open
          onOpenChange={(open) => {
            setAddMemberOpen(open)
            if (!open) setAddTargetSlotCode(null)
          }}
          slotName={addTargetSlotName}
          availableEditors={availableEditors}
          excludedMemberIds={getExcludedMemberIds()}
          onSubmit={handleAddMembers}
        />
      ) : null}

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('permissionAssignments.removeFromSlot.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('permissionAssignments.removeFromSlot.confirmDescription', {
                name: pendingRemoval?.member.fullName ?? '',
                level: pendingRemovalSlotName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>
              {t('permissionAssignments.removeFromSlot.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleConfirmRemove()
              }}
              disabled={isBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBusy
                ? t('permissionAssignments.removeFromSlot.removing')
                : t('permissionAssignments.removeFromSlot.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
