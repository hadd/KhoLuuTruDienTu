import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GroupList } from '@/features/group/components/GroupList'
import { CreateGroupDialog } from '@/features/group/components/CreateGroupDialog' 
import { AddMemberDialog } from '@/features/group/components/AddMemberDialog'
import { DeleteGroupDialog } from '@/features/group/components/DeleteGroupDialog'
import { MemberProfileDialog } from '@/features/group/components/MemberProfileDialog'
import { GroupSetupDialog } from '@/features/group/components/GroupSetupDialog'
import { useGroups, useRemoveMember } from '@/features/group/queries'
import { useGroupList } from '@/features/group/hooks/useGroupList'
import i18n from '@/lib/i18n/config'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/admin/groups/')({
  head: () => ({
    meta: [
      {
        title: `Quản lý nhóm - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ManageGroupRoute,
})

function ManageGroupRoute() {
  const { t } = useTranslation('common')
  const { data: groups = [], isLoading, isError } = useGroups()
  const [createGroupOpen, setCreateGroupOpen] = useState(false)

  const { state, actions } = useGroupList(groups)
  const { 
    selectedGroup, panelMode, deleteOpen, addMemberOpen,
    selectedMember, memberProfileOpen, setupGroupOpen,
    editMembersGroupId, memberToRemove, searchQuery,
    currentPage, editedGroupId, totalPages, paginatedGroups 
  } = state
  
  const { 
    setSelectedGroup, setPanelMode, setDeleteOpen, setAddMemberOpen,
    setSelectedMember, setMemberProfileOpen, setSetupGroupOpen,
    setEditMembersGroupId, setMemberToRemove, setCurrentPage,
    handleSearchChange, handleEditSave
  } = actions

  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveMember()

  return (
    <div className="flex w-full max-w-full flex-col space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={() => setCreateGroupOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('groupManagement.createNew')}
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

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa thành viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa thành viên <span className="font-semibold text-foreground">{memberToRemove?.member.name}</span> khỏi nhóm này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (memberToRemove) {
                  removeMember({ groupId: memberToRemove.groupId, memberId: memberToRemove.member.id }, {
                    onSuccess: () => setMemberToRemove(null)
                  });
                }
              }}
              disabled={isRemovingMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingMember ? 'Đang xóa...' : 'Chắc chắn xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}