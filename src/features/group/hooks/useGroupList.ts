import { useEffect, useMemo, useState } from 'react'
import type { Group, Member } from '../types'
import { filterGroups } from '../utils'

export function useGroupList(initialGroups: Array<Group>) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'edit' | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberProfileOpen, setMemberProfileOpen] = useState(false)
  const [setupGroupOpen, setSetupGroupOpen] = useState(false)

  const [editMembersGroupId, setEditMembersGroupId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{
    groupId: string
    member: Member
  } | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [editedGroupId, setEditedGroupId] = useState<string | null>(null)

  const filteredGroups = useMemo(
    () => filterGroups(initialGroups, searchQuery),
    [initialGroups, searchQuery],
  )

  const activeGroup = useMemo(
    () => filteredGroups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, filteredGroups],
  )

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setActiveGroupId(null)
      return
    }

    const stillVisible = filteredGroups.some((group) => group.id === activeGroupId)
    if (!activeGroupId || !stillVisible) {
      setActiveGroupId(filteredGroups[0].id)
    }
  }, [activeGroupId, filteredGroups])

  const handleEditSave = (groupId: string) => {
    setEditedGroupId(groupId);
    setTimeout(() => {
      setEditedGroupId(null);
    }, 3000); 
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  const handleSelectGroup = (groupId: string) => {
    setActiveGroupId(groupId)
  }

  return {
    state: {
      selectedGroup,
      activeGroupId,
      activeGroup,
      panelMode,
      deleteOpen,
      addMemberOpen,
      selectedMember,
      memberProfileOpen,
      setupGroupOpen,
      editMembersGroupId,
      memberToRemove,
      searchQuery,
      editedGroupId,
      filteredGroups,
    },
    actions: {
      setSelectedGroup,
      setActiveGroupId,
      setPanelMode,
      setDeleteOpen,
      setAddMemberOpen,
      setSelectedMember,
      setMemberProfileOpen,
      setSetupGroupOpen,
      setEditMembersGroupId,
      setMemberToRemove,
      setSearchQuery,
      handleEditSave,
      handleSearchChange,
      handleSelectGroup,
    },
  }
}
