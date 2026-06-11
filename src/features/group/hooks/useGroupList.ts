import { useState, useMemo } from 'react';
import type { Group, Member } from '../types';
import { filterGroups, paginateGroups } from '../utils';

export function useGroupList(initialGroups: Array<Group>) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [panelMode, setPanelMode] = useState<'view' | 'edit' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);
  const [setupGroupOpen, setSetupGroupOpen] = useState(false);
  
  const [editMembersGroupId, setEditMembersGroupId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{groupId: string, member: Member} | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 2; // 2 bảng mỗi trang

  const [editedGroupId, setEditedGroupId] = useState<string | null>(null);

  const filteredGroups = useMemo(() => filterGroups(initialGroups, searchQuery), [initialGroups, searchQuery]);
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = useMemo(() => paginateGroups(filteredGroups, currentPage, itemsPerPage), [filteredGroups, currentPage, itemsPerPage]);

  const handleEditSave = (groupId: string) => {
    setEditedGroupId(groupId);
    setTimeout(() => {
      setEditedGroupId(null);
    }, 3000); 
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return {
    state: {
      selectedGroup, panelMode, deleteOpen, addMemberOpen,
      selectedMember, memberProfileOpen, setupGroupOpen,
      editMembersGroupId, memberToRemove, searchQuery,
      currentPage, itemsPerPage, editedGroupId,
      totalPages, paginatedGroups
    },
    actions: {
      setSelectedGroup, setPanelMode, setDeleteOpen, setAddMemberOpen,
      setSelectedMember, setMemberProfileOpen, setSetupGroupOpen,
      setEditMembersGroupId, setMemberToRemove, setSearchQuery,
      setCurrentPage, handleEditSave, handleSearchChange
    }
  };
}
