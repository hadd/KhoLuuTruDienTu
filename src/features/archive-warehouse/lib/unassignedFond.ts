/** Route param for warehouse dossiers not assigned to any fond. */
export const UNASSIGNED_WAREHOUSE_FOND_ID = '_unassigned'

export function isUnassignedWarehouseFondId(
  fondId: string | null | undefined,
): boolean {
  return fondId === UNASSIGNED_WAREHOUSE_FOND_ID
}
