import { varchar, timestamp, text, index, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";
import { t } from "elysia";

export const apiAuditLogs = schema.table("api_audit_logs", {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: varchar("request_id", { length: 50 }),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "set null", onUpdate: "restrict" }),
    userRole: varchar("user_role", { length: 50 }),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    query: jsonb("query"),
    action: varchar("action", { length: 100 }),
    module: varchar("module", { length: 50 }),
    eventType: varchar("event_type", { length: 50 }),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 100 }),
    summary: text("summary"),
    sourceLogId: uuid("source_log_id"),
    statusCode: integer("status_code").notNull(),
    responseTime: integer("response_time"),
    ip: varchar("ip", { length: 50 }),
    userAgent: text("user_agent"),
    requestBody: jsonb("request_body"),
    responseBody: jsonb("response_body"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("api_audit_logs_request_id_idx").on(table.requestId),
    index("api_audit_logs_user_id_idx").on(table.userId),
    index("api_audit_logs_action_idx").on(table.action),
    index("api_audit_logs_status_code_idx").on(table.statusCode),
    index("api_audit_logs_created_at_idx").on(table.createdAt),
    index("api_audit_logs_user_created_idx").on(table.userId, table.createdAt),
    index("api_audit_logs_user_action_idx").on(table.userId, table.action),
    index("api_audit_logs_status_created_idx").on(table.statusCode, table.createdAt),
    index("api_audit_logs_created_at_desc_idx").on(sql`${table.createdAt} DESC`),
    index("api_audit_logs_errors_idx").on(table.statusCode, table.createdAt)
        .where(sql`${table.statusCode} >= 400`),
    index("api_audit_logs_module_created_idx").on(table.module, table.createdAt),
    index("api_audit_logs_event_type_created_idx").on(table.eventType, table.createdAt),
]);

export type ApiAuditLog = typeof apiAuditLogs.$inferSelect;
export type NewApiAuditLog = typeof apiAuditLogs.$inferInsert;

export const auditLogUserEntitySchema = t.Object({
    id: t.String(),
    email: t.String(),
    fullName: t.Union([t.String(), t.Null()]),
});

export const apiAuditLogEntitySchema = t.Object({
    id: t.String(),
    requestId: t.Union([t.String(), t.Null()]),
    userId: t.Union([t.String(), t.Null()]),
    userRole: t.Union([t.String(), t.Null()]),
    method: t.String(),
    path: t.String(),
    query: t.Union([t.Record(t.String(), t.Any()), t.Null()]),
    action: t.Union([t.String(), t.Null()]),
    module: t.Union([t.String(), t.Null()]),
    eventType: t.Union([t.String(), t.Null()]),
    entityType: t.Union([t.String(), t.Null()]),
    entityId: t.Union([t.String(), t.Null()]),
    summary: t.Union([t.String(), t.Null()]),
    sourceLogId: t.Union([t.String(), t.Null()]),
    statusCode: t.Number(),
    responseTime: t.Union([t.Number(), t.Null()]),
    ip: t.Union([t.String(), t.Null()]),
    userAgent: t.Union([t.String(), t.Null()]),
    requestBody: t.Union([t.Record(t.String(), t.Any()), t.Null()]),
    responseBody: t.Union([t.Record(t.String(), t.Any()), t.Null()]),
    error: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    user: t.Optional(t.Union([auditLogUserEntitySchema, t.Null()])),
});

export const apiAuditLogsRelations = relations(apiAuditLogs, ({ one }) => ({
  user: one(userProfiles, {
    fields: [apiAuditLogs.userId],
    references: [userProfiles.id],
  }),
}));