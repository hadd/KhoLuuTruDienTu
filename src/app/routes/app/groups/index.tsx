import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
import { requirePermission } from '@/features/auth/routeGuards'
import { AddMemberDialog } from '@/features/group/components/AddMemberDialog'
import { CreateGroupDialog } from '@/features/group/components/CreateGroupDialog'
import { DeleteGroupDialog } from '@/features/group/components/DeleteGroupDialog'
import { GroupList } from '@/features/group/components/GroupList'
import { GroupSetupDialog } from '@/features/group/components/GroupSetupDialog'
import { MemberProfileDialog } from '@/features/group/components/MemberProfileDialog'
import { useGroupList } from '@/features/group/hooks/useGroupList'
import {
  adminGroupsQueryOptions,
  metadataPermissionConfigsQueryOptions,
  useRemoveMember,
} from '@/features/group/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/groups/')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.groups.module,
    })
  },
  head: () => ({
    meta: [
      {
        title: `Quản lý nhóm - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(adminGroupsQueryOptions()),
      context.queryClient.ensureQueryData(
        metadataPermissionConfigsQueryOptions(),
      ),
    ])
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
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('error')}
      </h2>
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
  const { t } = useTranslation('group')
  const {
    data: groupsData,
    isLoading,
    isError,
  } = useQuery(adminGroupsQueryOptions())
  const groups = groupsData?.groups ?? []
  const [createGroupOpen, setCreateGroupOpen] = useState(false)

  const { state, actions } = useGroupList(groups)
  const {
    selectedGroup,
    panelMode,
    deleteOpen,
    addMemberOpen,
    selectedMember,
    memberProfileOpen,
    setupGroupOpen,
    editMembersGroupId,
    memberToRemove,
  } = state

  const {
    setSelectedGroup,
    setPanelMode,
    setDeleteOpen,
    setAddMemberOpen,
    setSelectedMember,
    setMemberProfileOpen,
    setSetupGroupOpen,
    setEditMembersGroupId,
    setMemberToRemove,
    handleEditSave,
  } = actions

  const { mutate: removeMember, isPending: isRemovingMember } =
    useRemoveMember()

  useEffect(() => {
    setSelectedGroup((prev) => {
      if (!prev) return prev
      const updatedGroup = groups.find((group) => group.id === prev.id)
      return updatedGroup ?? prev
    })
  }, [groups])

  return (
    <div
      className="-m-6 flex min-h-0 flex-col overflow-hidden p-4"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <GroupList
        groups={groups}
        isLoading={isLoading}
        isError={isError}
        state={state}
        actions={actions}
        onCreateGroup={() => setCreateGroupOpen(true)}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
      />

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        group={selectedGroup}
        mode="add"
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
                if (!memberToRemove) return

                const group = groups.find(
                  (item) => item.id === memberToRemove.groupId,
                )
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
