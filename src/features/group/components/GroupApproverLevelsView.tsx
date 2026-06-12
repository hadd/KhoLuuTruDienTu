import { UserPlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Group, GroupQcLevelT, GroupQcMemberT } from '@/features/group/types'
import { getLevelGridClass } from '@/features/group/lib/qcLevels'

interface GroupApproverLevelsViewProps {
  group: Group
  levels?: Array<GroupQcLevelT>
  isEditing?: boolean
  /** Cho phép thêm/xóa thành viên duyệt khi đã chọn cấu hình phân quyền */
  canManageMembers?: boolean
  onMemberClick?: (member: GroupQcMemberT) => void
  onRemoveMember?: (level: number, member: GroupQcMemberT) => void
  onRemoveLevel?: (level: number) => void
  onAddApprovers?: (level: number) => void
}

function getLevelLabel(
  level: { level: number },
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return t('card.approverLevel', { level: level.level })
}

export function GroupApproverLevelsView({
  group,
  levels,
  isEditing = false,
  canManageMembers = false,
  onMemberClick,
  onRemoveMember,
  onRemoveLevel,
  onAddApprovers,
}: GroupApproverLevelsViewProps) {
  const { t } = useTranslation('group')
  const qcLevels = [...(levels ?? group.qcLevels)].sort((a, b) => a.level - b.level)
  const canEditMembers = isEditing || canManageMembers

  if (qcLevels.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">{t('card.empty')}</p>
    )
  }

  return (
    <div className={getLevelGridClass(qcLevels.length)}>
      {qcLevels.map((level) => (
        <Card
          key={level.level}
          variant="default"
          className="group/card overflow-hidden bg-card shadow-none"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">
              {getLevelLabel(level, t)}
            </span>
            {canEditMembers ? (
              <div className="flex shrink-0 items-center gap-0.5">
                {onAddApprovers ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-primary hover:bg-primary/10"
                    onClick={() => onAddApprovers(level.level)}
                    aria-label={t('card.actions.addApprover')}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                {isEditing && onRemoveLevel ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveLevel(level.level)}
                    aria-label={t('card.actions.removeApprovalLevel')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="min-h-[56px] px-3 py-3 pt-3">
            {level.members.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {level.members.map((member) => (
                  <div
                    key={member.userId}
                    className="group relative"
                  >
                    <Badge
                      variant={level.level === 1 ? 'default' : 'secondary'}
                      className={`py-1 font-normal ${
                        !canEditMembers && onMemberClick ? 'cursor-pointer hover:opacity-80' : ''
                      } ${canEditMembers ? 'pr-3' : ''}`}
                      onClick={
                        !canEditMembers && onMemberClick
                          ? () => onMemberClick(member)
                          : undefined
                      }
                    >
                      {member.name}
                    </Badge>
                    {canEditMembers && onRemoveMember ? (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(level.level, member)}
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
              <p className="text-xs text-muted-foreground italic">
                {t('configTemplate.zone.empty')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
