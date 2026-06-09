import { useState, useEffect } from 'react'
import { UserPlus, X, Save, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateGroup, useRemoveMember } from '../queries'
import type { Group } from '../types'

interface GroupSidePanelProps {
  group: Group
  mode: 'view' | 'edit'
  onClose: () => void
  onAddMemberClick: () => void
  onEditSuccess?: (groupId: string) => void
}

export function GroupSidePanel({
  group,
  mode,
  onClose,
  onAddMemberClick,
  onEditSuccess,
}: GroupSidePanelProps) {
  const { t } = useTranslation('group')
  const { mutate: updateGroup, isPending: isUpdating } = useUpdateGroup()
  const { mutate: removeMember, isPending: isRemoving } = useRemoveMember()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description)
    }
  }, [group])

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    updateGroup(
      {
        id: group.id,
        payload: {
          name: name.trim(),
          description: description.trim(),
          editorIds: group.editorUserIds,
          qcIds: group.qcUserIds,
        },
      },
      {
        onSuccess: () => {
          onEditSuccess?.(group.id)
        },
      },
    )
  }

  const handleRemoveMember = (memberId: string) => {
    const member = group.members.find((item) => item.id === memberId)
    if (!member) return

    if (member.role !== 'member') {
      return
    }

    if (confirm(t('removeMember.confirmDescription', { name: member.name }))) {
      removeMember({ group, member })
    }
  }

  const getRoleLabel = (role: Group['members'][number]['role']) => {
    switch (role) {
      case 'leader':
        return t('leader')
      case 'manager':
        return t('manager')
      default:
        return t('member')
    }
  }

  return (
    <div className="w-full h-full flex flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">
          {mode === 'edit' ? t('sidePanel.editTitle') : t('sidePanel.viewTitle')}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {mode === 'edit' ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('sidePanel.fields.name')}</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">{t('sidePanel.fields.description')}</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUpdating}
              />
            </div>
            <Button type="submit" disabled={isUpdating} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isUpdating ? t('sidePanel.actions.saving') : t('sidePanel.actions.save')}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-sm text-muted-foreground block mb-1">
                {t('sidePanel.fields.name')}
              </span>
              <span className="text-base">{group.name}</span>
            </div>
            <div>
              <span className="font-semibold text-sm text-muted-foreground block mb-1">
                {t('sidePanel.fields.description')}
              </span>
              <span className="text-base">{group.description || t('sidePanel.noDescription')}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">
                {t('sidePanel.membersTitle', { count: group.memberCount })}
              </h3>
            </div>
            {mode === 'edit' && (
              <Button variant="outline" size="sm" onClick={onAddMemberClick}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('sidePanel.actions.addMember')}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm bg-muted/10"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.email} - {getRoleLabel(member.role)}
                  </span>
                </div>
                {mode === 'edit' && member.role === 'member' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isRemoving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t('sidePanel.actions.removeMember')}</span>
                  </Button>
                )}
              </div>
            ))}
            {group.members.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6 border rounded-md border-dashed">
                {t('sidePanel.emptyMembers')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
