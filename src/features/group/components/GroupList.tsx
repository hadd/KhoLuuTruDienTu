import { useTranslation } from 'react-i18next'

import type { Group } from '../types'
import { GroupCard } from './GroupCard'
import { GroupSidePanel } from './GroupSidePanel'
import { GroupToolbar } from './GroupToolbar'

interface GroupListState {
  selectedGroup: Group | null
  activeGroupId: string | null
  activeGroup: Group | null
  panelMode: 'view' | 'edit' | null
  editMembersGroupId: string | null
  searchQuery: string
  editedGroupId: string | null
  filteredGroups: Array<Group>
}

interface GroupListActions {
  setSelectedGroup: (group: Group) => void
  setPanelMode: (mode: 'view' | 'edit' | null) => void
  setDeleteOpen: (open: boolean) => void
  setAddMemberOpen: (open: boolean) => void
  setSelectedMember: (member: Group['members'][number]) => void
  setMemberProfileOpen: (open: boolean) => void
  setEditMembersGroupId: (value: string | null) => void
  setMemberToRemove: (
    payload: { groupId: string; member: Group['members'][number] } | null,
  ) => void
  handleEditSave: (groupId: string) => void
  handleSearchChange: (query: string) => void
  handleSelectGroup: (groupId: string) => void
}

interface GroupListProps {
  groups: Array<Group>
  isLoading: boolean
  isError: boolean
  state: GroupListState
  actions: GroupListActions
  onCreateGroup: () => void
}

export function GroupList({
  isLoading,
  isError,
  state,
  actions,
  onCreateGroup,
}: GroupListProps) {
  const { t } = useTranslation('group')

  const {
    selectedGroup,
    activeGroup,
    panelMode,
    editMembersGroupId,
    searchQuery,
    editedGroupId,
    activeGroupId,
    filteredGroups,
  } = state

  const {
    setSelectedGroup,
    setPanelMode,
    setDeleteOpen,
    setAddMemberOpen,
    setSelectedMember,
    setMemberProfileOpen,
    setEditMembersGroupId,
    setMemberToRemove,
    handleEditSave,
    handleSearchChange,
    handleSelectGroup,
  } = actions

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {t('error')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <GroupToolbar
          groups={filteredGroups}
          activeGroup={activeGroup}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSelectGroup={handleSelectGroup}
          onCreateGroup={onCreateGroup}
        />

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {activeGroup ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <GroupCard
                group={activeGroup}
                isEdited={editedGroupId === activeGroup.id}
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
          ) : (
            <div className="flex h-full min-h-[240px] items-center justify-center text-center text-muted-foreground">
              {t('noData')}
            </div>
          )}
        </div>
      </div>

      {panelMode && selectedGroup ? (
        <div className="h-full min-h-[320px] w-full shrink-0 overflow-hidden rounded-md border border-border shadow-sm lg:w-[400px] xl:w-[450px]">
          <GroupSidePanel
            group={selectedGroup}
            mode={panelMode}
            onClose={() => {
              setPanelMode(null)
            }}
            onAddMemberClick={() => setAddMemberOpen(true)}
            onEditSuccess={handleEditSave}
          />
        </div>
      ) : null}
    </div>
  )
}
