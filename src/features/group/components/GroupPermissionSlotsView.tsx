import { useQuery } from '@tanstack/react-query'
import { Loader2, Save, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { permissionConfigQueryOptions } from '@/features/data-config/queries'
import {
  useAssignGroupMetadataPermissionConfig,
  useUpdateGroupPermissionAssignments,
} from '@/features/group/queries'
import { getLevelGridClass } from '@/features/group/lib/qcLevels'
import { groupConfigStore, useGroupConfig } from '@/features/group/store'
import type { Group, GroupZoneMemberT } from '@/features/group/types'

import { AddSlotEditorDialog } from './AddSlotEditorDialog'

interface GroupPermissionSlotsViewProps {
  group: Group
  isEditing?: boolean
}

export function GroupPermissionSlotsView({ group, isEditing = false }: GroupPermissionSlotsViewProps) {
  const { t } = useTranslation('group')
  const { metadataPermissionConfigId, slotAssignmentsBySlotCode } =
    useGroupConfig(group.id)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addTargetSlotCode, setAddTargetSlotCode] = useState<string | null>(null)
  const { mutateAsync: assignConfig, isPending: isAssigningConfig } =
    useAssignGroupMetadataPermissionConfig()
  const { mutateAsync: saveAssignments, isPending: isSaving } =
    useUpdateGroupPermissionAssignments()
  const [isDirty, setIsDirty] = useState(false)

  const { data: configDetail, isLoading } = useQuery({
    ...permissionConfigQueryOptions(metadataPermissionConfigId ?? ''),
    enabled: Boolean(metadataPermissionConfigId),
  })

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

  const initialSlotAssignments = useMemo(() => {
    const assignments: Record<string, Array<GroupZoneMemberT>> = {}

    for (const member of group.members) {
      if (member.role !== 'member' || !member.permissionSlotCode) continue

      const slotCode = member.permissionSlotCode
      const current = assignments[slotCode] ?? []
      assignments[slotCode] = [
        ...current,
        {
          userId: member.userId,
          fullName: member.name,
          email: member.email,
        },
      ]
    }

    return assignments
  }, [group.members])

  useEffect(() => {
    if (Object.keys(slotAssignmentsBySlotCode).length > 0) return
    if (Object.keys(initialSlotAssignments).length === 0) return

    groupConfigStore.initSlotAssignments(group.id, initialSlotAssignments)
  }, [group.id, initialSlotAssignments, slotAssignmentsBySlotCode])

  const slots = useMemo(
    () =>
      [...(configDetail?.slots ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    [configDetail?.slots],
  )

  const addTargetSlotName =
    slots.find((slot) => slot.slotCode === addTargetSlotCode)?.slotName ?? ''

  const handleAddMembers = (members: Array<GroupZoneMemberT>) => {
    if (!addTargetSlotCode) return

    for (const member of members) {
      groupConfigStore.addSlotMember(group.id, addTargetSlotCode, member)
    }
    setIsDirty(true)
  }

  const getExcludedMemberIds = () =>
    Object.values(slotAssignmentsBySlotCode).flatMap((members) =>
      members.map((member) => member.userId),
    )

  const handleRemoveMember = (slotCode: string, userId: string) => {
    groupConfigStore.removeSlotMember(group.id, slotCode, userId)
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!metadataPermissionConfigId) return

    try {
      await assignConfig({
        groupId: group.id,
        permissionConfigId: metadataPermissionConfigId,
      })

      const current = groupConfigStore.getState().configByGroupId[group.id]
      if (!current) return

      await saveAssignments({
        groupId: group.id,
        payload: {
          assignments: slots.map((slot) => ({
            slotCode: slot.slotCode,
            editorIds: (current.slotAssignmentsBySlotCode[slot.slotCode] ?? []).map(
              (member) => member.userId,
            ),
          })),
        },
      })

      setIsDirty(false)
    } catch {
      // Error toasts handled in mutations
    }
  }

  if (!metadataPermissionConfigId) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('permissionAssignments.selectConfigFirst')}
      </p>
    )
  }

  if (isLoading) {
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

  const isBusy = isSaving || isAssigningConfig

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('configTemplate.sections.editor')}
          </div>
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={!isEditing || !isDirty || isBusy}
            onClick={() => void handleSave()}
          >
            {isBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            {isBusy
              ? t('permissionAssignments.saving')
              : t('permissionAssignments.save')}
          </Button>
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
                    {slot.slotName || t('card.approverLevel', { level: index + 1 })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={isBusy || !isEditing}
                    onClick={() => {
                      setAddTargetSlotCode(slot.slotCode)
                      setAddMemberOpen(true)
                    }}
                    aria-label={t('card.actions.addMember')}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
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
                          <Badge variant="secondary" className="py-1 pr-3 font-normal">
                            {member.fullName}
                          </Badge>
                          {isEditing ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleRemoveMember(slot.slotCode, member.userId)
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
    </>
  )
}
