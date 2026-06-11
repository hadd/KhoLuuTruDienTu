import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { groupConfigStore } from '@/features/group/store'
import type { GroupConfigLevelT, GroupZoneMemberT } from '@/features/group/types'
import { AddZoneMemberDialog } from './AddZoneMemberDialog'

interface GroupZoneCardProps {
  groupId: string
  level: GroupConfigLevelT
  members: Array<GroupZoneMemberT>
}

export function GroupZoneCard({ groupId, level, members }: GroupZoneCardProps) {
  const { t } = useTranslation('group')
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const existingMemberIds = members.map((m) => m.userId)

  return (
    <>
      <Card variant="bordered" className="bg-muted/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
          <span className="text-sm font-semibold">{level.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setAddMemberOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {t('configTemplate.zone.addMember')}
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {members.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <div key={member.userId} className="relative group">
                  <Badge variant="secondary" className="font-normal py-1 pr-3">
                    {member.fullName}
                  </Badge>
                  <button
                    type="button"
                    onClick={() =>
                      groupConfigStore.removeZoneMember(groupId, level.id, member.userId)
                    }
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:bg-destructive/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={t('configTemplate.zone.removeMember')}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">{t('configTemplate.zone.empty')}</p>
          )}
        </CardContent>
      </Card>

      <AddZoneMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        groupId={groupId}
        levelId={level.id}
        levelType={level.type}
        levelName={level.name}
        existingMemberIds={existingMemberIds}
      />
    </>
  )
}
