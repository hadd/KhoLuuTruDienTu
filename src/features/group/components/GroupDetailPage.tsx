import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AddMemberDialog } from '@/features/group/components/AddMemberDialog'
import { DeleteGroupDialog } from '@/features/group/components/DeleteGroupDialog'
import { GroupCard } from '@/features/group/components/GroupCard'
import { GroupSetupDialog } from '@/features/group/components/GroupSetupDialog'
import { MemberProfileDialog } from '@/features/group/components/MemberProfileDialog'
import {
  groupDetailQueryOptions,
  metadataPermissionConfigsQueryOptions,
  useRemoveMember,
} from '@/features/group/queries'
import type { Group, Member } from '@/features/group/types'

const routeApi = getRouteApi('/app/groups/$groupId')

export function GroupDetailPage() {
  const { t } = useTranslation('group')
  const { groupId } = routeApi.useParams()
  const navigate = routeApi.useNavigate()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberProfileOpen, setMemberProfileOpen] = useState(false)
  const [setupGroupOpen, setSetupGroupOpen] = useState(false)
  const [editMembersGroupId, setEditMembersGroupId] = useState<string | null>(
    null,
  )
  const [memberToRemove, setMemberToRemove] = useState<{
    groupId: string
    member: Member
  } | null>(null)
  const [editedGroupId, setEditedGroupId] = useState<string | null>(null)

  const {
    data: group,
    isPending,
    isError,
  } = useQuery(groupDetailQueryOptions(groupId))

  useQuery(metadataPermissionConfigsQueryOptions())

  const { mutate: removeMember, isPending: isRemovingMember } =
    useRemoveMember()

  const handleEditSave = (savedGroupId: string) => {
    setEditedGroupId(savedGroupId)
    setTimeout(() => {
      setEditedGroupId(null)
    }, 3000)
  }

  const handleBack = () => {
    void navigate({ to: '/app/groups' })
  }

  const activeGroup = group ?? selectedGroup

  if (isPending) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        {t('detailLoading')}
      </div>
    )
  }

  if (isError || !group) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-destructive">{t('detailError')}</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 size-4" />
          {t('detail.back')}
        </Button>
      </div>
    )
  }

  return (
    <div
      className="-m-6 flex min-h-0 flex-col overflow-hidden p-4"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <div className="mb-4 shrink-0">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 size-4" />
          {t('detail.back')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card p-4">
        <GroupCard
          group={group}
          isEdited={editedGroupId === group.id}
          isSelected={false}
          editMembersGroupId={editMembersGroupId}
          setEditMembersGroupId={setEditMembersGroupId}
          handleEditSave={handleEditSave}
          setSelectedGroup={setSelectedGroup}
          setAddMemberOpen={setAddMemberOpen}
          setDeleteOpen={setDeleteOpen}
          setSelectedMember={setSelectedMember}
          setMemberProfileOpen={setMemberProfileOpen}
          setMemberToRemove={setMemberToRemove}
        />
      </div>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        group={activeGroup}
        mode="add"
      />

      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        group={activeGroup}
        onDeleted={() => {
          setSelectedGroup(null)
          handleBack()
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
        group={activeGroup}
      />

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('removeMember.confirmTitle')}
            </AlertDialogTitle>
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
                if (!memberToRemove || !group) return

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
              disabled={
                isRemovingMember || memberToRemove?.member.role !== 'member'
              }
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
