import { Pencil, Trash2, UserPlus, X, FilePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { Group, Member } from '../types';

interface GroupCardProps {
  group: Group;
  isEdited: boolean;
  isSelected: boolean;
  editMembersGroupId: string | null;
  setEditMembersGroupId: (value: string | null) => void;
  handleEditSave: (groupId: string) => void;
  setSelectedGroup: (group: Group) => void;
  setAddMemberOpen: (open: boolean) => void;
  setDeleteOpen: (open: boolean) => void;
  setSelectedMember: (member: Member) => void;
  setMemberProfileOpen: (open: boolean) => void;
  setMemberToRemove: (payload: { groupId: string; member: Member } | null) => void;
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
  const leaders = group.members?.filter((member) => member.role === 'leader') || [];
  const managers = group.members?.filter((member) => member.role === 'manager') || [];
  const normalMembers = group.members?.filter((member) => member.role === 'member') || [];

  const isEditing = editMembersGroupId === group.id;

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
                placeholder="Tên nhóm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  defaultValue={group.description || ''}
                  className="h-8 text-sm flex-1 min-w-[220px]"
                  placeholder="Mô tả nhóm"
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    handleEditSave(group.id);
                    setEditMembersGroupId(null);
                  }}
                >
                  Lưu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setEditMembersGroupId(null)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-3">
              <div className="flex items-start gap-2 min-w-[220px] flex-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-semibold line-clamp-1">{group.name}</span>
                  <span className="text-sm text-muted-foreground line-clamp-2">{group.description || 'Chưa có mô tả'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditMembersGroupId(group.id)}
                  aria-label="Sửa tên và mô tả nhóm"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <div
                className="rounded-md border bg-muted/5 px-3 py-2 text-sm flex items-center gap-4"
                title="Bạn có thể nhập số trực tiếp để cấu hình"
              >
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase">Giới hạn thành viên</span>
                  <input
                    type="number"
                    defaultValue={50}
                    min={1}
                    className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-16 p-0 m-0 h-5 mt-1"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase whitespace-nowrap">Hồ sơ/Ngư</span>
                  <input
                    type="number"
                    defaultValue={200}
                    min={1}
                    className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-20 p-0 m-0 h-5 mt-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Khu vực các nút icon Actions bên phải - Đã được xếp dọc bằng flex-col */}
        <div className="flex flex-col items-end gap-2">
          <TooltipProvider>
            {/* Dòng 1: Thêm thành viên và Xóa */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => {
                      setSelectedGroup(group);
                      setAddMemberOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Thêm thành viên</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedGroup(group);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Xóa nhóm</TooltipContent>
              </Tooltip>
            </div>

         {/* Dòng 2: Nút Gán hồ sơ tối đa (đã xuống dòng) */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-blue-600 hover:bg-blue-600/10 hover:text-blue-700 px-2"
                onClick={() => {
                  alert(`Đã gán số lượng hồ sơ = số lượng hồ sơ tối đa cho nhóm/ người ${group.name}!`);
                }}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                Gán hồ sơ
              </Button>
            </div>
          </TooltipProvider>
        </div>
      </CardFooter>

      <CardContent className="flex-1 pb-4 pt-4 space-y-4">
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 border border-dashed border-border/70 rounded-md p-3">
          <div className="text-left">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Người duyệt ({leaders.length + managers.length})
            </div>
            {leaders.length + managers.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {[...leaders, ...managers].map((member, index) => {
                  const label = leaders.length > 0
                    ? (index === 0 ? 'Leader' : `Duyệt ${index + 1}`)
                    : `Duyệt ${index + 1}`;
                  const isLeader = member.role === 'leader';

                  return (
                    <div key={member.id} className="min-w-[140px] flex-1">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {label}
                      </div>
                      <div className="relative group mt-1 w-fit">
                        <Badge
                          variant={isLeader ? 'default' : 'outline'}
                          className={`cursor-pointer hover:opacity-80 transition-opacity font-normal py-1 pr-3 ${
                            isLeader
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-yellow-500 text-yellow-950 border-yellow-500 hover:bg-yellow-600'
                          }`}
                          onClick={() => {
                            setSelectedMember(member);
                            setMemberProfileOpen(true);
                          }}
                        >
                          <span className="text-sm font-medium">{member.name}</span>
                        </Badge>
                        {member.role === 'member' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToRemove({ groupId: group.id, member });
                            }}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:bg-destructive/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Xóa thành viên"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Không có</span>
            )}
          </div>

          <div className="text-left">
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Thành viên ({normalMembers.length})
            </div>
            <div className="flex gap-2 flex-wrap">
              {normalMembers.length > 0 ? normalMembers.map((member) => (
                <div key={member.id} className="relative group">
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:opacity-80 transition-opacity font-normal py-1 pr-3"
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberProfileOpen(true);
                    }}
                  >
                    {member.name} ({member.documents?.length || 0})
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberToRemove({ groupId: group.id, member });
                    }}
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:bg-destructive/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Xóa thành viên"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )) : <span className="text-xs text-muted-foreground italic">Không có</span>}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
