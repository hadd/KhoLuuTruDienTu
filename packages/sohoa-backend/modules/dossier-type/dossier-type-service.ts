import { eq } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import { dossierTypes } from "../../db/schemas/dossier-type.ts";
import {
    createDossierTypeSchema,
    dossierTypeEntitySchema,
    updateDossierTypeSchema,
} from "./types.ts";

const crud = createCrudService({
    db,
    table: dossierTypes,
    searchable: ["id", "name", "description"],
    entitySchema: dossierTypeEntitySchema,
    createSchema: createDossierTypeSchema,
    updateSchema: updateDossierTypeSchema,
    metadata: {
        tags: ["DossierType"],
        descriptions: {
            list: "List dossier types with pagination, filtering and search.",
            get: "Get a dossier type by ID.",
            create: "Create a dossier type record.",
            update: "Update a dossier type record (cannot update ID).",
            delete: "Delete a dossier type record.",
        },
    },
});

export const DossierTypeService = {
    ...crud,

    async listActive() {
        const items = await db
            .select()
            .from(dossierTypes)
            .where(eq(dossierTypes.isActive, true))
            .orderBy(dossierTypes.name);
        return { items };
    },

    async create(body: Parameters<typeof crud.create>[0]) {
        return crud.create({
            ...body,
            isActive: body.isActive ?? true,
        });
    },
};
