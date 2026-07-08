/** Virtual root id for the data-management folder tree */
export const DATA_TREE_ROOT_ID = 'dm-root'

/**
 * Sentinel selection meaning "Tất cả" (all projects). Kept as a real,
 * non-empty value so it is distinguishable from "no selection yet", but it is
 * normalized to `undefined` before hitting the API (no `projectCode` sent).
 */
export const ALL_PROJECTS_CODE = '__all__'

/** Map a UI project selection to the value sent to the API (omit for "Tất cả"). */
export function toScopedProjectCode(
  projectCode?: string | null,
): string | undefined {
  const trimmed = projectCode?.trim()
  if (!trimmed || trimmed === ALL_PROJECTS_CODE) {
    return undefined
  }
  return trimmed
}

/** Backend role ids for assign-by-folder API */
export const ASSIGN_FOLDER_ROLE = {
  maker: 'MAKER',
  checker: (level: number) => `CHECKER_${level}`,
} as const

/** User role ids treated as document editors in assignment UI */
export const EDITOR_USER_ROLE_IDS = ['editor', 'editer'] as const
