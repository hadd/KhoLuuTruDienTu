import {
    integer,
    timestamp,
    uuid,
    text,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { physicalWarehouseItems } from "./physical-warehouse-item.ts";
import { archiveSubmissions } from "./archive-submission.ts";
import { dossierPhysicalPlacementStatusEnum } from "./dossier-physical-placement-enums.ts";

export const dossierPhysicalPlacements = schema.table(
    "dossier_physical_placements",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        dossierId: uuid("dossier_id")
            .notNull()
            .references(() => dossiers.id, {
                onDelete: "cascade",
                onUpdate: "restrict",
            }),
        physicalItemId: uuid("physical_item_id")
            .notNull()
            .references(() => physicalWarehouseItems.id, {
                onDelete: "restrict",
                onUpdate: "restrict",
            }),
        locationRootId: uuid("location_root_id").references(
            () => physicalWarehouseItems.id,
            {
                onDelete: "set null",
                onUpdate: "restrict",
            },
        ),
        archiveSubmissionId: uuid("archive_submission_id").references(
            () => archiveSubmissions.id,
            {
                onDelete: "set null",
                onUpdate: "restrict",
            },
        ),
        units: integer("units").notNull().default(1),
        status: dossierPhysicalPlacementStatusEnum("status").notNull(),
        placedBy: text("placed_by"),
        placedAt: timestamp("placed_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        notes: text("notes"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("idx_dossier_physical_placements_dossier_id").on(table.dossierId),
        index("idx_dossier_physical_placements_physical_item_id").on(
            table.physicalItemId,
        ),
        index("idx_dossier_physical_placements_status").on(table.status),
        uniqueIndex("uq_dossier_physical_placements_active_dossier")
            .on(table.dossierId)
            .where(sql`${table.status} = 'ACTIVE'`),
    ],
);

export type DossierPhysicalPlacement =
    typeof dossierPhysicalPlacements.$inferSelect;
export type NewDossierPhysicalPlacement =
    typeof dossierPhysicalPlacements.$inferInsert;
