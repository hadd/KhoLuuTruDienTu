import { buildCheckerAssignmentsFromGroup } from '@/features/group/lib/buildCheckerAssignmentsFromGroup'
import { GroupApproverLevelsView } from '@/features/group/components/GroupApproverLevelsView'
import type { Group } from '@/features/group/types'
import { useTranslation } from 'react-i18next'

interface GroupAssignPreviewProps {
  group: Group | null
}

export function GroupAssignPreview({ group }: GroupAssignPreviewProps) {
  const { t } = useTranslation('group')

  if (!group) return null

  const checkerLevels = buildCheckerAssignmentsFromGroup(group)
  const roundNumber = group.roundNumber ?? checkerLevels.length

  if (roundNumber === 0 || checkerLevels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('assignFolder.checkerPreview.empty')}
      </p>
    )
  }

  const previewLevels = checkerLevels.map((level) => ({
    level: level.level,
    role: `Duyệt ${level.level}`,
    members: level.members.map((member) => ({
      memberId: member.userId,
      userId: member.userId,
      name: member.name,
      email: member.email,
    })),
  }))

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t('assignFolder.checkerPreview.title', { count: roundNumber })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('assignFolder.checkerPreview.hint')}
        </p>
      </div>
      <GroupApproverLevelsView group={group} levels={previewLevels} />
    </div>
  )
}
