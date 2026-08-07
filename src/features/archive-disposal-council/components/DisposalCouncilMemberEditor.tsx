import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { emptyCouncilMemberRow } from '@/features/archive-disposal-council/lib/disposalCouncilMemberDrafts'
import type {
  DisposalCouncilMemberInputT,
  DisposalCouncilMemberPositionRoleT,
  DisposalCouncilMemberRepresentationTypeT,
} from '@/features/archive-disposal-council/types'
import { UserSingleSelectField } from '@/features/group/components/UserSingleSelectField'
import type { UserT } from '@/features/user/types'



const REPRESENTATION_TYPES: Array<DisposalCouncilMemberRepresentationTypeT> = [
  'LEADERSHIP',
  'ARCHIVE_DEPT',
  'SPECIALIST_DEPT',
  'OTHER',
]

type DisposalCouncilMemberEditorProps = {
  members: Array<DisposalCouncilMemberInputT>
  onChange: (next: Array<DisposalCouncilMemberInputT>) => void
  users: Array<UserT>
  isUsersLoading: boolean
  showReason?: boolean
  changeReason?: string
  onChangeReason?: (reason: string) => void
}

export function DisposalCouncilMemberEditor({
  members,
  onChange,
  users,
  isUsersLoading,
  showReason = false,
  changeReason = '',
  onChangeReason,
}: DisposalCouncilMemberEditorProps) {
  const { t } = useTranslation('archive-disposal-council')

  return (
    <div className="space-y-3">
      {members.map((member, index) => (
        <div
          key={`member-row-${index}`}
          className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_140px_180px_auto]"
        >
          <div className="min-w-0">
            <UserSingleSelectField
              label={t('form.memberUser')}
              placeholder={t('form.memberUserPlaceholder')}
              searchPlaceholder={t('form.memberUserPlaceholder')}
              emptyLabel={t('form.memberUserPlaceholder')}
              noResultsLabel={t('form.memberUserPlaceholder')}
              loadingLabel={t('form.memberUserPlaceholder')}
              users={users.filter(
                (u) => !members.some((m, j) => j !== index && m.userId === u.id)
              )}
              isLoading={isUsersLoading}
              selectedId={member.userId}
              onSelect={(userId) => {
                const next = [...members]
                const selectedUser = users.find((u) => u.id === userId)
                const roleName = selectedUser?.userRoles?.[0]?.role?.name || ''
                next[index] = { ...next[index]!, userId, positionRole: roleName }
                onChange(next)
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('form.positionRole')}</Label>
            <Input
              readOnly
              value={member.positionRole}
              placeholder={t('form.positionRole')}
              className="bg-muted h-10"
            />
          </div>
          <div className="space-y-1">
            <Label>{t('form.representationType')}</Label>
            <Select
              value={member.representationType}
              onValueChange={(value) => {
                const next = [...members]
                next[index] = {
                  ...next[index]!,
                  representationType: value as DisposalCouncilMemberRepresentationTypeT,
                }
                onChange(next)
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPRESENTATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`roles.representation.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-3"
              disabled={members.length <= 1}
              onClick={() => onChange(members.filter((_, rowIndex) => rowIndex !== index))}
            >
              {t('form.removeMember')}
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...members, emptyCouncilMemberRow(members.length)])}
      >
        <Plus className="mr-2 size-4" />
        {t('form.addMember')}
      </Button>
      {showReason ? (
        <div className="space-y-1">
          <Label htmlFor="member-change-reason">{t('form.reason')}</Label>
          <Textarea
            id="member-change-reason"
            value={changeReason}
            placeholder={t('form.reasonPlaceholder')}
            onChange={(event) => onChangeReason?.(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('form.reasonRequired')}</p>
        </div>
      ) : null}
    </div>
  )
}
