import {
    index,
    timestamp,
    uniqueIndex,
    uuid,
    text,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { roles } from "./role.ts";
import { securityLevels } from "./security-level.ts";

/**
 * Maps a system role to the maximum security level it may approve
 * for electronic archive borrow requests (level_order ≤ assigned level).
 */
export const archiveBorrowApprovalClearances = schema.table(
    "archive_borrow_approval_clearances",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roleId: text("role_id")
            .notNull()
            .references(() => roles.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        maxSecurityLevelId: uuid("max_security_level_id")
            .notNull()
            .references(() => securityLevels.id, {
                onDelete: "restrict",
                onUpdate: "cascade",
            }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("uq_archive_borrow_approval_clearances_role")
            .on(table.roleId)
            .where(sql`${table.deletedAt} IS NULL`),
        index("idx_archive_borrow_approval_clearances_level").on(
            table.maxSecurityLevelId,
        ),
    ],
);

export type ArchiveBorrowApprovalClearance =
    typeof archiveBorrowApprovalClearances.$inferSelect;
export type NewArchiveBorrowApprovalClearance =
    typeof archiveBorrowApprovalClearances.$inferInsert;

export const archiveBorrowApprovalClearancesRelations = relations(
    archiveBorrowApprovalClearances,
    ({ one }) => ({
        role: one(roles, {
            fields: [archiveBorrowApprovalClearances.roleId],
            references: [roles.id],
        }),
        maxSecurityLevel: one(securityLevels, {
            fields: [archiveBorrowApprovalClearances.maxSecurityLevelId],
            references: [securityLevels.id],
        }),
    }),
);
