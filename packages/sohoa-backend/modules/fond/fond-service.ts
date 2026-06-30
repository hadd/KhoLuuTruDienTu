import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { createFondSchema, fondEntitySchema, updateFondSchema } from "./types.ts";

const crud = createCrudService({
    db,
    table: fonds,
    searchable: ["id", "fondName", "archiveAgency", "fondType"],
    entitySchema: fondEntitySchema,
    createSchema: createFondSchema,
    updateSchema: updateFondSchema,
    metadata: {
        tags: ["Fond"],
        descriptions: {
            list: "List fonds with pagination, filtering and search.",
            get: "Get a fond by ID.",
            create: "Create a fond record.",
            update: "Update a fond record (cannot update ID).",
            delete: "Delete a fond record.",
        },
    },
});

export const FondService = {
    ...crud,
};
