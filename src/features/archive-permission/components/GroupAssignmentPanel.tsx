import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GroupArchiveBindingEditor } from '@/features/archive-permission/components/GroupArchiveBindingEditor'
import { adminGroupsQueryOptions, groupDetailQueryOptions } from '@/features/group/queries'

interface GroupAssignmentPanelProps {
  selectedGroupId: string | null
  onSelectGroupId: (groupId: string) => void
}

export function GroupAssignmentPanel({
  selectedGroupId,
  onSelectGroupId,
}: GroupAssignmentPanelProps) {
  const { t } = useTranslation('archive-permission')
  const [groupSearch, setGroupSearch] = useState('')

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery(
    adminGroupsQueryOptions({ page: 1, limit: 100 }),
  )
  const { data: groupDetail, isLoading: isLoadingDetail } = useQuery({
    ...groupDetailQueryOptions(selectedGroupId ?? ''),
    enabled: Boolean(selectedGroupId),
  })

  const groups = groupsData?.groups ?? []

  const filteredGroups = useMemo(() => {
    const normalized = groupSearch.trim().toLowerCase()
    if (!normalized) return groups
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(normalized) ||
        (group.projectName ?? '').toLowerCase().includes(normalized) ||
        (group.projectCode ?? '').toLowerCase().includes(normalized),
    )
  }, [groupSearch, groups])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">{t('groupAssign.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('groupAssign.description')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <Label>{t('groupAssign.selectGroup')}</Label>
          <Input
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
            placeholder={t('groupAssign.groupPlaceholder')}
          />
          <div className="max-h-80 overflow-y-auto rounded-md border lg:max-h-[calc(100dvh-20rem)]">
            {isLoadingGroups ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t('groupAssign.groupPlaceholder')}
              </p>
            ) : (
              filteredGroups.map((group) => {
                const selected = selectedGroupId === group.id
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent ${
                      selected ? 'bg-accent/70' : ''
                    }`}
                    onClick={() => onSelectGroupId(group.id)}
                  >
                    <span className="font-medium">{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.projectName ?? group.projectCode ?? '—'} ·{' '}
                      {t('groupAssign.memberCount', {
                        count: group.memberCount,
                      })}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-md border border-border p-4">
          {!selectedGroupId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('groupAssign.emptyGroup')}
            </p>
          ) : isLoadingDetail || !groupDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GroupArchiveBindingEditor group={groupDetail} />
          )}
        </div>
      </div>
    </div>
  )
}
