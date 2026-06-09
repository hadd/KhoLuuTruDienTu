import type { GroupMemberRole } from "../../db/schemas/types.ts";

export const QC_GROUP_ROLES = ["qc1", "qc2", "qc3", "qc4", "qc5"] as const satisfies readonly GroupMemberRole[];

export const QC_MEMBER_ROLES: GroupMemberRole[] = [...QC_GROUP_ROLES];
