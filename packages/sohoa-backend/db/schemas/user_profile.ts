import { varchar, text, timestamp, index, uniqueIndex, uuid, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { t } from "elysia";
import { userRoles } from "./user_role.ts";
import { genderElysiaType } from "./enums.ts";
import { schema } from "./schema-helper.ts";
import { groupMembers } from "./group_members.ts";

export const userProfiles = schema.table("user_profiles", {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    // Demographic fields
    dateOfBirth: date("date_of_birth"),
    gender: varchar("gender", { length: 50 }),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("user_profiles_email_active_idx")
        .on(table.email)
        .where(sql`${table.deletedAt} IS NULL`),
    index("user_profiles_active_idx").on(table.email, table.fullName).where(sql`${table.deletedAt} IS NULL`),
]);
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// Validation schemas for API endpoints
export const createUserProfileSchema = t.Object({
    email: t.String(),
    fullName: t.Optional(t.String()),
    avatarUrl: t.Optional(t.String()),
    // Demographic fields
    dateOfBirth: t.Optional(t.String()),
    gender: t.Optional(genderElysiaType),
    phone: t.Optional(t.String({ maxLength: 50 })),
    address: t.Optional(t.String()),
    lastLoginAt: t.Optional(t.Date())
});

export const updateUserProfileSchema = t.Object({
    fullName: t.Optional(t.String()),
    avatarUrl: t.Optional(t.String()),
    // Demographic fields
    dateOfBirth: t.Optional(t.String()),
    gender: t.Optional(genderElysiaType),
    phone: t.Optional(t.String({ maxLength: 50 })),
    address: t.Optional(t.String()),
    lastLoginAt: t.Optional(t.Date()),
});

export const updateUserProfileWithRoleSchema = t.Object({
    ...t.Object({
        fullName: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        gender: t.Optional(genderElysiaType),
        phone: t.Optional(t.String({ maxLength: 50 })),
        address: t.Optional(t.String()),
        lastLoginAt: t.Optional(t.Date()),
    }).properties,
    roleId: t.Optional(t.String()),
});

export const createUserProfileWithRoleSchema = t.Object({
    email: t.String(),
    fullName: t.Optional(t.String()),
    avatarUrl: t.Optional(t.String()),
    dateOfBirth: t.Optional(t.String()),
    gender: t.Optional(genderElysiaType),
    phone: t.Optional(t.String({ maxLength: 50 })),
    address: t.Optional(t.String()),
    lastLoginAt: t.Optional(t.Date()),
    password: t.String({ minLength: 8 }),
    roleId: t.Optional(t.String()),
});
// Relations
export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    userRoles: many(userRoles),
    groupMembers: many(groupMembers),
}));


