import { z } from "zod";

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["leader", "manager", "member"]),
  joinedAt: z.string(),
});

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  memberCount: z.number(),
  members: z.array(memberSchema),
  createdAt: z.string(),
});

export type GroupSchema = z.infer<typeof groupSchema>;
export type MemberSchema = z.infer<typeof memberSchema>;
