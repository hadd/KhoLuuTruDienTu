import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import { retentionPeriods } from "../../db/schemas/retention-period.ts";
import {
    createRetentionPeriodSchema,
    retentionPeriodEntitySchema,
    updateRetentionPeriodSchema,
} from "./types.ts";

const crud = createCrudService({
    db,
    table: retentionPeriods,
    searchable: ["id", "name", "description"],
    entitySchema: retentionPeriodEntitySchema,
    createSchema: createRetentionPeriodSchema,
    updateSchema: updateRetentionPeriodSchema,
    metadata: {
        tags: ["RetentionPeriod"],
        descriptions: {
            list: "List retention periods with pagination, filtering and search.",
            get: "Get a retention period by ID.",
            create: "Create a retention period record.",
            update: "Update a retention period record (cannot update ID).",
            delete: "Delete a retention period record.",
        },
    },
});

export const RetentionPeriodService = {
    ...crud,
};
