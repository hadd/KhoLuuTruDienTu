import type { Group } from './types';

export const filterGroups = (groups: Group[], query: string): Group[] => {
  if (!query) return groups;
  const lowerQuery = query.toLowerCase();
  return groups.filter(
    (g) =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.description?.toLowerCase().includes(lowerQuery)
  );
};

export const paginateGroups = (groups: Group[], page: number, perPage: number): Group[] => {
  const start = (page - 1) * perPage;
  return groups.slice(start, start + perPage);
};
