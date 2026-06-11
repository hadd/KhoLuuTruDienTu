import type { GroupConfigTemplateT } from '../types'

export const GROUP_CONFIG_TEMPLATES: Array<GroupConfigTemplateT> = [
  {
    id: 'default',
    name: 'Default',
    isDefault: true,
    levels: [],
  },
  {
    id: 'template-2-level',
    name: '2 cấp duyệt',
    levels: [
      { id: 'level-editor-1', name: 'Biên tập cấp 1', type: 'editor', order: 1 },
      { id: 'level-approver-1', name: 'Duyệt cấp 1', type: 'approver', order: 2 },
      { id: 'level-approver-2', name: 'Duyệt cấp 2', type: 'approver', order: 3 },
    ],
  },
  {
    id: 'template-3-level',
    name: '2 cấp biên tập + 1 cấp duyệt',
    levels: [
      { id: 'level-editor-1', name: 'Biên tập cấp 1', type: 'editor', order: 1 },
      { id: 'level-editor-2', name: 'Biên tập cấp 2', type: 'editor', order: 2 },
      { id: 'level-approver-1', name: 'Duyệt cấp 1', type: 'approver', order: 3 },
    ],
  },
]

export function createInitialGroupConfigState() {
  return {
    templates: GROUP_CONFIG_TEMPLATES,
    configByGroupId: {} as Record<
      string,
      {
        groupId: string
        templateId: string
        membersByLevelId: Record<string, Array<{ userId: string; fullName: string; email: string }>>
      }
    >,
  }
}
