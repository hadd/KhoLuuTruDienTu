import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GroupList } from '@/features/group/components/GroupList'
import { CreateGroupDialog } from '@/features/group/components/CreateGroupDialog' 
import { AddMemberDialog } from '@/features/group/components/AddMemberDialog'
import { DeleteGroupDialog } from '@/features/group/components/DeleteGroupDialog'
import { MemberProfileDialog } from '@/features/group/components/MemberProfileDialog'
import { GroupSetupDialog } from '@/features/group/components/GroupSetupDialog'
import { FieldAssignmentDialog } from '@/features/group/components/FieldAssignmentDialog'
import { adminGroupsQueryOptions, useRemoveMember } from '@/features/group/queries'
import { useGroupList } from '@/features/group/hooks/useGroupList'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/admin/groups/')({
  head: () => ({
    meta: [
      {
        title: `Quản lý nhóm - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminGroupsQueryOptions())
    return {}
  },
  component: ManageGroupRoute,
  errorComponent: AdminGroupsErrorComponent,
})

function AdminGroupsErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('group')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">{t('error')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('error')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}

function ManageGroupRoute() {
  const { t: tCommon } = useTranslation('common')
  const { t } = useTranslation('group')
  const { data: groups = [], isLoading, isError } = useQuery(adminGroupsQueryOptions())
  const [createGroupOpen, setCreateGroupOpen] = useState(false)

  const { state, actions } = useGroupList(groups)
  const { 
    selectedGroup, panelMode, deleteOpen, addMemberOpen,
    selectedMember, memberProfileOpen, setupGroupOpen, fieldAssignmentOpen,
    editMembersGroupId, memberToRemove, searchQuery,
    currentPage, editedGroupId, totalPages, paginatedGroups 
  } = state
  
  const { 
    setSelectedGroup, setPanelMode, setDeleteOpen, setAddMemberOpen,
    setSelectedMember, setMemberProfileOpen, setSetupGroupOpen,
    setEditMembersGroupId, setMemberToRemove, setCurrentPage,
    handleSearchChange, handleEditSave, setFieldAssignmentOpen
  } = actions

  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveMember()

  useEffect(() => {
    if (!selectedGroup) return
    const updatedGroup = groups.find((group) => group.id === selectedGroup.id)
    if (updatedGroup) {
      setSelectedGroup(updatedGroup)
    }
  }, [groups, selectedGroup, setSelectedGroup])

  return (
    <div className="flex w-full max-w-full flex-col space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={() => setCreateGroupOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {tCommon('groupManagement.createNew')}
          </Button>
        </div>
      </div>

      <GroupList 
        groups={groups} 
        isLoading={isLoading} 
        isError={isError} 
        state={state}
        actions={actions}
      />

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        group={selectedGroup}
      />

      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        group={selectedGroup}
        onDeleted={() => {
          setSelectedGroup(null)
          setPanelMode(null)
        }}
      />

      <MemberProfileDialog
        open={memberProfileOpen}
        onOpenChange={setMemberProfileOpen}
        member={selectedMember}
      />

      <GroupSetupDialog
        open={setupGroupOpen}
        onOpenChange={setSetupGroupOpen}
        group={selectedGroup}
      />

      <FieldAssignmentDialog
        open={fieldAssignmentOpen}
        onOpenChange={setFieldAssignmentOpen}
        group={selectedGroup}
      />

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeMember.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeMember.confirmDescription', {
                name: memberToRemove?.member.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember}>
              {t('removeMember.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (!memberToRemove) return

                const group = groups.find((item) => item.id === memberToRemove.groupId)
                if (!group) return

                if (memberToRemove.member.role !== 'member') {
                  setMemberToRemove(null)
                  return
                }

                removeMember(
                  { group, member: memberToRemove.member },
                  {
                    onSuccess: () => setMemberToRemove(null),
                  },
                )
              }}
              disabled={isRemovingMember || memberToRemove?.member.role !== 'member'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingMember
                ? t('removeMember.removing')
                : t('removeMember.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}