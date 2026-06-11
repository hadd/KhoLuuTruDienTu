export type DocumentStatus = 'Biên tập' | 'Chờ duyệt' | 'Duyệt' | 'Hoàn thành';

export type GroupConfigLevelTypeT = 'editor' | 'approver'

export interface GroupConfigLevelT {
  id: string
  name: string
  type: GroupConfigLevelTypeT
  order: number
}

export interface GroupConfigTemplateT {
  id: string
  name: string
  isDefault?: boolean
  levels: Array<GroupConfigLevelT>
}

export interface GroupZoneMemberT {
  userId: string
  fullName: string
  email: string
}

export interface GroupConfigInstanceT {
  groupId: string
  templateId: string
  membersByLevelId: Record<string, Array<GroupZoneMemberT>>
}

export interface UserDocument {
  id: string;
  title: string;
  status: DocumentStatus;
  updatedAt: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'leader' | 'manager' | 'member';
  joinedAt: string;
  documents: Array<UserDocument>;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  members: Array<Member>;
  editorUserIds: Array<string>;
  qcUserIds: Array<string>;
  createdAt: string;
  /** From API when available */
  roundNumber?: number;
}

export interface GroupListProps {
  groups: Array<Group>;
  isLoading: boolean
  isError: boolean
}

export interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  group: Group | null
}
