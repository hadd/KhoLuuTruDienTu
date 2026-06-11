import { useTranslation } from 'react-i18next'

import { filterLevelsByType } from '@/features/group/lib/groupConfigHelpers'
import type { GroupConfigTemplateT, GroupZoneMemberT } from '@/features/group/types'
import { GroupZoneCard } from './GroupZoneCard'

interface GroupTemplateZonesViewProps {
  groupId: string
  template: GroupConfigTemplateT
  membersByLevelId: Record<string, Array<GroupZoneMemberT>>
}

export function GroupTemplateZonesView({
  groupId,
  template,
  membersByLevelId,
}: GroupTemplateZonesViewProps) {
  const { t } = useTranslation('group')

  const editorLevels = filterLevelsByType(template.levels, 'editor')
  const approverLevels = filterLevelsByType(template.levels, 'approver')

  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 border border-dashed border-border/70 rounded-md p-3">
      {editorLevels.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('configTemplate.sections.editor')}
          </h4>
          <div className="space-y-2">
            {editorLevels.map((level) => (
              <GroupZoneCard
                key={level.id}
                groupId={groupId}
                level={level}
                members={membersByLevelId[level.id] ?? []}
              />
            ))}
          </div>
        </section>
      )}

      {approverLevels.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('configTemplate.sections.approver')}
          </h4>
          <div className="space-y-2">
            {approverLevels.map((level) => (
              <GroupZoneCard
                key={level.id}
                groupId={groupId}
                level={level}
                members={membersByLevelId[level.id] ?? []}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
