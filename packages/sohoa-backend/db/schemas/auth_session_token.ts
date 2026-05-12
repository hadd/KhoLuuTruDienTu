import { varchar, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { authSessions } from "./auth_session.ts";
import { schema } from "./schema-helper.ts";

export const authSessionTokenTypeEnum = schema.enum("auth_session_token_type", [
    "access_token",
    "refresh_token",
]);

export const authSessionTokens = schema.table("auth_session_tokens", {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => authSessions.id, { onDelete: "cascade", onUpdate: "restrict" }),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade", onUpdate: "restrict" }),
    type: authSessionTokenTypeEnum("type").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
    index("auth_session_tokens_session_type_idx").on(table.sessionId, table.type),
    index("auth_session_tokens_user_expires_idx").on(table.userId, table.expiresAt),
    index("auth_session_tokens_hash_active_idx").on(table.tokenHash).where(sql`${table.revokedAt} IS NULL`),
]);

export type AuthSessionToken = typeof authSessionTokens.$inferSelect;
export type NewAuthSessionToken = typeof authSessionTokens.$inferInsert;

export const authSessionTokensRelations = relations(authSessionTokens, ({ one }) => ({
    session: one(authSessions, {
        fields: [authSessionTokens.sessionId],
        references: [authSessions.id],
    }),
    userProfile: one(userProfiles, {
        fields: [authSessionTokens.userId],
        references: [userProfiles.id],
    }),
}));
