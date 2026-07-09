import type { Group, GroupListItem } from './types'

export const filterGroups = (
  groups: Array<GroupListItem>,
  query: string,
): Array<GroupListItem> => {
  if (!query) return groups
  const lowerQuery = query.toLowerCase()
  return groups.filter(
    (g) =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.description?.toLowerCase().includes(lowerQuery),
  )
}
