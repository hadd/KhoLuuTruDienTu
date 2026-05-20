import type { Group, Member } from '../types';
import { mockGroups } from './mockData';

// Simulated delay function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let currentGroups = [...mockGroups];

export const groupApi = {
  getGroups: async (): Promise<Array<Group>> => {
    await delay(500); // Simulate network latency
    return [...currentGroups];
  },

  getGroupById: async (id: string): Promise<Group | undefined> => {
    await delay(500);
    return currentGroups.find((g) => g.id === id);
  },

  addMemberToGroup: async (groupId: string, member: Omit<Member, 'id' | 'joinedAt'>): Promise<Member> => {
    await delay(500); // Simulate network
    const groupIndex = currentGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) throw new Error('Group not found');

    const newMember: Member = {
      ...member,
      id: `m${Math.random().toString(36).substring(2, 9)}`,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    currentGroups = [...currentGroups];
    const groupToUpdate = { ...currentGroups[groupIndex] };
    
    groupToUpdate.members = [...groupToUpdate.members, newMember];
    groupToUpdate.memberCount += 1;
    currentGroups[groupIndex] = groupToUpdate;

    return newMember;
  },

  deleteGroup: async (id: string): Promise<void> => {
    await delay(500);
    currentGroups = currentGroups.filter(g => g.id !== id);
  },

  updateGroup: async (id: string, data: Partial<Group>): Promise<Group> => {
    await delay(500);
    const groupIndex = currentGroups.findIndex((g) => g.id === id);
    if (groupIndex === -1) throw new Error('Group not found');
    
    currentGroups = [...currentGroups];
    currentGroups[groupIndex] = { ...currentGroups[groupIndex], ...data };
    return currentGroups[groupIndex];
  },
  
  removeMemberFromGroup: async (groupId: string, memberId: string): Promise<void> => {
    await delay(500);
    const groupIndex = currentGroups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) throw new Error('Group not found');
    
    currentGroups = [...currentGroups];
    const groupToUpdate = { ...currentGroups[groupIndex] };
    groupToUpdate.members = groupToUpdate.members.filter(m => m.id !== memberId);
    groupToUpdate.memberCount = groupToUpdate.members.length;
    currentGroups[groupIndex] = groupToUpdate;
  }
};
