import { boolean, index, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { t } from "elysia";

export const auditLogConfigs = schema.table("audit_log_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    module: varchar("module", { length: 50 }).notNull(),
    actionKey: varchar("action_key", { length: 50 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    label: varchar("label", { length: 200 }).notNull(),
}, (table) => [
    uniqueIndex("audit_log_configs_module_action_unique").on(table.module, table.actionKey),
    index("audit_log_configs_module_idx").on(table.module),
]);

export type AuditLogConfig = typeof auditLogConfigs.$inferSelect;
export type NewAuditLogConfig = typeof auditLogConfigs.$inferInsert;

export const auditLogConfigEntitySchema = t.Object({
    id: t.String(),
    module: t.String(),
    actionKey: t.String(),
    enabled: t.Boolean(),
    label: t.String(),
});
