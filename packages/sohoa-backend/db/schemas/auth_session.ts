import { varchar, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { schema } from "./schema-helper.ts";

export const authSessions = schema.table("auth_sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade", onUpdate: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 45 }),
}, (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_idx").on(table.expiresAt),
    index("auth_sessions_active_idx").on(table.userId).where(sql`${table.revokedAt} IS NULL`),
]);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
    userProfile: one(userProfiles, {
        fields: [authSessions.userId],
        references: [userProfiles.id],
    }),
}));
