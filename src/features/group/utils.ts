import type { Group } from './types'

export const filterGroups = (groups: Array<Group>, query: string): Array<Group> => {
  if (!query) return groups
  const lowerQuery = query.toLowerCase()
  return groups.filter(
    (g) =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.description?.toLowerCase().includes(lowerQuery),
  )
}
