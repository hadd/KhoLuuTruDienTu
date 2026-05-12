import { apiAuditLogs } from "../../db/schemas/api-audit-log.ts";

export type AuditLog = typeof apiAuditLogs.$inferSelect;
export type NewAuditLog = typeof apiAuditLogs.$inferInsert;
