import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { Group } from '../types';
import { GroupSidePanel } from './GroupSidePanel';
import { GroupCard } from './GroupCard';

export function GroupList({ groups, isLoading, isError, state, actions }: { groups: Array<Group>, isLoading: boolean, isError: boolean, state: any, actions: any }) {
  const { t } = useTranslation('group' as any);
  
  const { 
    selectedGroup, panelMode,
    editMembersGroupId, searchQuery,
    currentPage, editedGroupId, totalPages, paginatedGroups 
  } = state;
  const { 
    setSelectedGroup, setPanelMode, setDeleteOpen, setAddMemberOpen,
    setSelectedMember, setMemberProfileOpen,
    setEditMembersGroupId, setMemberToRemove, setCurrentPage,
    handleSearchChange, handleEditSave
  } = actions;

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {t('error')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('search')} 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex w-full flex-col lg:flex-row gap-6 max-w-full overflow-hidden">
        {/* Grid Layout Cards */}
        <div className={`flex-1 flex flex-col gap-4 min-w-0 transition-all duration-300 ${panelMode ? 'lg:w-1/2' : 'w-full'}`}>
          <div className={`grid grid-cols-1 ${panelMode ? 'xl:grid-cols-1' : 'md:grid-cols-2'} gap-4`}>
            {paginatedGroups.length === 0 ? (
              <div className="col-span-full rounded-md border border-border p-8 text-center text-muted-foreground bg-card">
                {t('noData')}
              </div>
            ) : (
              paginatedGroups.map((group: Group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isEdited={editedGroupId === group.id}
                  isSelected={!!(selectedGroup?.id === group.id && panelMode)}
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
              ))
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev: number) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </Button>
              <div className="text-sm border px-3 py-1.5 rounded-md">
                {t('pagination.page', { current: currentPage, total: totalPages })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev: number) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right side: Panel (View/Edit) */}
        {panelMode && selectedGroup && (
          <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 rounded-md border border-border shadow-sm overflow-hidden h-[min(800px,calc(100vh-200px))] sticky top-4">
            <GroupSidePanel
              group={selectedGroup}
              mode={panelMode}
              onClose={() => {
                setPanelMode(null);
              }}
              onAddMemberClick={() => setAddMemberOpen(true)}
              onEditSuccess={handleEditSave}
            />
          </div>
        )}
      </div>
    </div>
  );
}