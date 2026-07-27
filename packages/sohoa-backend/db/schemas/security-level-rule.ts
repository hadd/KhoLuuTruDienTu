import { varchar, timestamp, index, uniqueIndex, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { securityLevels } from "./security-level.ts";

/**
 * Rule cấu hình theo cấp (Nhóm 1 permission.* + Nhóm 2 flag.*).
 * isOverridden=false → kế thừa effective từ cấp liền kề thấp hơn.
 */
export const securityLevelRules = schema.table("security_level_rules", {
    id: uuid("id").defaultRandom().primaryKey(),
    securityLevelId: uuid("security_level_id").notNull().references(() => securityLevels.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    ruleKey: varchar("rule_key", { length: 96 }).notNull(),
    isOverridden: boolean("is_overridden").notNull().default(false),
    /** bool | { roleIds, userIds } | { formats } — meaningful when overridden or lowest level */
    value: jsonb("value").$type<unknown>().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("security_level_rules_level_rule_unique")
        .on(table.securityLevelId, table.ruleKey),
    index("idx_security_level_rules_level_id").on(table.securityLevelId),
    index("idx_security_level_rules_rule_key").on(table.ruleKey),
]);

export type SecurityLevelRule = typeof securityLevelRules.$inferSelect;
export type NewSecurityLevelRule = typeof securityLevelRules.$inferInsert;

export const securityLevelRulesRelations = relations(securityLevelRules, ({ one }) => ({
    securityLevel: one(securityLevels, {
        fields: [securityLevelRules.securityLevelId],
        references: [securityLevels.id],
    }),
}));
