import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { Group, Member } from '@/features/group/types'

interface GroupDefaultMembersViewProps {
  group: Group
  setSelectedMember: (member: Member) => void
  setMemberProfileOpen: (open: boolean) => void
  setMemberToRemove: (payload: { groupId: string; member: Member } | null) => void
}

export function GroupDefaultMembersView({
  group,
  setSelectedMember,
  setMemberProfileOpen,
  setMemberToRemove,
}: GroupDefaultMembersViewProps) {
  const { t } = useTranslation('group')

  const leaders = group.members?.filter((member) => member.role === 'leader') || []
  const managers = group.members?.filter((member) => member.role === 'manager') || []
  const normalMembers = group.members?.filter((member) => member.role === 'member') || []

  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 border border-dashed border-border/70 rounded-md p-3">
      <div className="text-left">
        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {t('card.approvers', { count: leaders.length + managers.length })}
        </div>
        {leaders.length + managers.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {[...leaders, ...managers].map((member, index) => {
              const label = leaders.length > 0
                ? (index === 0 ? t('leader') : t('card.approverLevel', { level: index + 1 }))
                : t('card.approverLevel', { level: index + 1 })
              const isLeader = member.role === 'leader'

              return (
                <div key={member.id} className="min-w-[140px] flex-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                  </div>
                  <div className="relative group mt-1 w-fit">
                    <Badge
                      variant={isLeader ? 'default' : 'outline'}
                      className={`cursor-pointer hover:opacity-80 transition-opacity font-normal py-1 pr-3 ${
                        isLeader
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-yellow-500 text-yellow-950 border-yellow-500 hover:bg-yellow-600'
                      }`}
                      onClick={() => {
                        setSelectedMember(member)
                        setMemberProfileOpen(true)
                      }}
                    >
                      <span className="text-sm font-medium">{member.name}</span>
                    </Badge>
                    {member.role === 'member' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMemberToRemove({ groupId: group.id, member })
                        }}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:bg-destructive/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={t('configTemplate.zone.removeMember')}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">{t('card.empty')}</span>
        )}
      </div>

      <div className="text-left">
        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {t('card.members', { count: normalMembers.length })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {normalMembers.length > 0 ? normalMembers.map((member) => (
            <div key={member.id} className="relative group flex flex-col items-start">
              <div className="relative">
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:opacity-80 transition-opacity font-normal py-1 pr-3"
                  onClick={() => {
                    setSelectedMember(member)
                    setMemberProfileOpen(true)
                  }}
                >
                  {member.name} ({member.documents?.length || 0})
                </Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMemberToRemove({ groupId: group.id, member })
                  }}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:bg-destructive/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('configTemplate.zone.removeMember')}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          )) : (
            <span className="text-xs text-muted-foreground italic">{t('card.empty')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
