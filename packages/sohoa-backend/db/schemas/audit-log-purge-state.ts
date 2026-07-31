import { text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const auditLogPurgeState = schema.table("audit_log_purge_state", {
    id: uuid("id").defaultRandom().primaryKey(),
    cursorUntil: timestamp("cursor_until", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    leaseOwner: varchar("lease_owner", { length: 100 }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogPurgeState = typeof auditLogPurgeState.$inferSelect;
export type NewAuditLogPurgeState = typeof auditLogPurgeState.$inferInsert;
