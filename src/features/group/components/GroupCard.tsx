import { Pencil, Trash2, UserPlus, FilePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useGroupConfig } from '@/features/group/store'

import type { Group, Member } from '../types'
import { GroupConfigTemplateSelect } from './GroupConfigTemplateSelect'
import { GroupDefaultMembersView } from './GroupDefaultMembersView'
import { GroupTemplateZonesView } from './GroupTemplateZonesView'

interface GroupCardProps {
  group: Group
  isEdited: boolean
  isSelected: boolean
  editMembersGroupId: string | null
  setEditMembersGroupId: (value: string | null) => void
  handleEditSave: (groupId: string) => void
  setSelectedGroup: (group: Group) => void
  setAddMemberOpen: (open: boolean) => void
  setDeleteOpen: (open: boolean) => void
  setSelectedMember: (member: Member) => void
  setMemberProfileOpen: (open: boolean) => void
  setMemberToRemove: (payload: { groupId: string; member: Member } | null) => void
}

export function GroupCard({
  group,
  isEdited,
  isSelected,
  editMembersGroupId,
  setEditMembersGroupId,
  handleEditSave,
  setSelectedGroup,
  setAddMemberOpen,
  setDeleteOpen,
  setSelectedMember,
  setMemberProfileOpen,
  setMemberToRemove,
}: GroupCardProps) {
  const { t } = useTranslation('group')
  const { templates, templateId, template, membersByLevelId, isDefaultTemplate } =
    useGroupConfig(group.id)

  const isEditing = editMembersGroupId === group.id

  return (
    <Card
      className={`relative flex flex-col transition-colors ${
        isEdited ? 'border-green-500 ring-2 ring-green-500 bg-green-500/5' :
        isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-border/80'
      }`}
    >
      <CardFooter className="border-b bg-muted/20 px-4 py-3 flex flex-col lg:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {isEditing ? (
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <Input
                defaultValue={group.name}
                className="h-8 font-semibold text-lg"
                placeholder={t('card.fields.namePlaceholder')}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  defaultValue={group.description || ''}
                  className="h-8 text-sm flex-1 min-w-[220px]"
                  placeholder={t('card.fields.descriptionPlaceholder')}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    handleEditSave(group.id)
                    setEditMembersGroupId(null)
                  }}
                >
                  {t('card.actions.save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setEditMembersGroupId(null)}
                >
                  {t('card.actions.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-start gap-2 min-w-[220px] flex-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-semibold line-clamp-1">{group.name}</span>
                    <span className="text-sm text-muted-foreground line-clamp-2">
                      {group.description || t('card.noDescription')}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditMembersGroupId(group.id)}
                    aria-label={t('card.actions.editNameDescription')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  className="rounded-md border bg-muted/5 px-3 py-2 text-sm flex items-center gap-4"
                  title={t('card.limitsHint')}
                >
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-[10px] uppercase">
                      {t('memberLimit')}
                    </span>
                    <input
                      type="number"
                      defaultValue={50}
                      min={1}
                      className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-16 p-0 m-0 h-5 mt-1"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-[10px] uppercase whitespace-nowrap">
                      {t('maxTasks')}
                    </span>
                    <input
                      type="number"
                      defaultValue={200}
                      min={1}
                      className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-20 p-0 m-0 h-5 mt-1"
                    />
                  </div>
                </div>
              </div>

              <GroupConfigTemplateSelect
                groupId={group.id}
                templates={templates}
                templateId={templateId}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => {
                      setSelectedGroup(group)
                      setAddMemberOpen(true)
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('card.actions.addMember')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedGroup(group)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('card.actions.deleteGroup')}</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-blue-600 hover:bg-blue-600/10 hover:text-blue-700 px-2"
                onClick={() => {
                  alert(t('card.assignTasksAlert', { name: group.name }))
                }}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                {t('assignTasks')}
              </Button>
            </div>
          </TooltipProvider>
        </div>
      </CardFooter>

      <CardContent className="flex-1 pb-4 pt-4 space-y-4">
        {isDefaultTemplate ? (
          <GroupDefaultMembersView
            group={group}
            setSelectedMember={setSelectedMember}
            setMemberProfileOpen={setMemberProfileOpen}
            setMemberToRemove={setMemberToRemove}
          />
        ) : (
          template && (
            <GroupTemplateZonesView
              groupId={group.id}
              template={template}
              membersByLevelId={membersByLevelId}
            />
          )
        )}
      </CardContent>
    </Card>
  )
}
