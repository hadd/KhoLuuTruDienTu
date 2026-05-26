/** Virtual root id for the data-management folder tree */
export const DATA_TREE_ROOT_ID = 'dm-root'

/** Backend role ids for assign-by-folder API */
export const ASSIGN_FOLDER_ROLE = {
  maker: 'MAKER',
  checker: (level: number) => `CHECKER_${level}`,
} as const

/** User role ids treated as document editors in assignment UI */
export const EDITOR_USER_ROLE_IDS = ['editor', 'editer'] as const
