import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type {
  Group,
  GroupQcLevelT,
  GroupQcMemberT,
  Member,
} from '@/features/group/types'

import { GroupApproverLevelsView } from './GroupApproverLevelsView'

interface GroupDefaultMembersViewProps {
  group: Group
  isEditing?: boolean
  displayQcLevels?: Array<GroupQcLevelT>
  setSelectedMember: (member: Member) => void
  setMemberProfileOpen: (open: boolean) => void
  setMemberToRemove: (
    payload: { groupId: string; member: Member } | null,
  ) => void
  onRemoveApprover?: (level: number, member: GroupQcMemberT) => void
  onRemoveApprovalLevel?: (level: number) => void
  onAddApprovers?: (level: number) => void
}

function findMemberByUserId(group: Group, userId: string): Member | undefined {
  return group.members.find((member) => member.userId === userId)
}

export function GroupDefaultMembersView({
  group,
  isEditing = false,
  displayQcLevels,
  setSelectedMember,
  setMemberProfileOpen,
  setMemberToRemove,
  onRemoveApprover,
  onRemoveApprovalLevel,
  onAddApprovers,
}: GroupDefaultMembersViewProps) {
  const { t } = useTranslation('group')

  const normalMembers =
    group.members?.filter((member) => member.role === 'member') || []
  const qcLevels = displayQcLevels ?? group.qcLevels
  const approverCount = qcLevels.reduce(
    (total, level) => total + level.members.length,
    0,
  )

  return (
    <div className="space-y-4">
      <div className="text-left space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('card.approvers', { count: approverCount })}
        </div>
        <GroupApproverLevelsView
          group={group}
          levels={displayQcLevels}
          isEditing={isEditing}
          onMemberClick={
            isEditing
              ? undefined
              : (qcMember) => {
                  const member = findMemberByUserId(group, qcMember.userId)
                  if (!member) return
                  setSelectedMember(member)
                  setMemberProfileOpen(true)
                }
          }
          onRemoveMember={onRemoveApprover}
          onRemoveLevel={onRemoveApprovalLevel}
          onAddApprovers={onAddApprovers}
        />
      </div>

      <div className="text-left">
        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {t('card.members', { count: normalMembers.length })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {normalMembers.length > 0 ? (
            normalMembers.map((member) => (
              <div
                key={member.id}
                className="relative group flex flex-col items-start"
              >
                <div className="relative">
                  <Badge
                    variant="secondary"
                    className={`font-normal py-1 transition-opacity ${
                      isEditing ? 'pr-3' : 'cursor-pointer hover:opacity-80'
                    }`}
                    onClick={
                      isEditing
                        ? undefined
                        : () => {
                            setSelectedMember(member)
                            setMemberProfileOpen(true)
                          }
                    }
                  >
                    {member.name} ({member.documents?.length || 0})
                  </Badge>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMemberToRemove({ groupId: group.id, member })
                      }}
                      className="absolute -top-1.5 -right-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity hover:bg-destructive/80 group-hover:opacity-100"
                      aria-label={t('configTemplate.zone.removeMember')}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {t('card.empty')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
