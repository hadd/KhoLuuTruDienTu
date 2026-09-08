import { varchar, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { schema } from "./schema-helper.ts";

export const authTwoFactorOtps = schema.table("auth_two_factor_otps", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade", onUpdate: "restrict" }),
    challengeToken: varchar("challenge_token", { length: 255 }).notNull(),
    otpHash: varchar("otp_hash", { length: 255 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("auth_2fa_challenge_idx").on(table.challengeToken),
    index("auth_2fa_user_idx").on(table.userId),
    index("auth_2fa_active_idx").on(table.challengeToken).where(sql`${table.usedAt} IS NULL`),
]);

export type AuthTwoFactorOtp = typeof authTwoFactorOtps.$inferSelect;
export type NewAuthTwoFactorOtp = typeof authTwoFactorOtps.$inferInsert;

export const authTwoFactorOtpsRelations = relations(authTwoFactorOtps, ({ one }) => ({
    userProfile: one(userProfiles, {
        fields: [authTwoFactorOtps.userId],
        references: [userProfiles.id],
    }),
}));
