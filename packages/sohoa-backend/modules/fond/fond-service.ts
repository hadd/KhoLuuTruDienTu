import { createCrudService } from "@shared/base-crud";
import { db } from "../../db/db-conn.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { createFondSchema, fondEntitySchema, updateFondSchema } from "./types.ts";

import { dossiers } from "../../db/schemas/dossier.ts";
import { eq, isNull, sql, and } from "drizzle-orm";

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

import { inArray } from "drizzle-orm";

export const FondService = {
    ...crud,
    
    async list(input: any) {
        const result = await crud.list(input);
        const fondIds = result.items.map(i => i.id);
        
        if (fondIds.length === 0) {
            return {
                ...result,
                items: []
            };
        }

        const counts = await db
            .select({
                fondId: dossiers.fondId,
                dossierCount: sql<number>`count(${dossiers.id})`.mapWith(Number)
            })
            .from(dossiers)
            .where(and(
                inArray(dossiers.fondId, fondIds),
                isNull(dossiers.deletedAt)
            ))
            .groupBy(dossiers.fondId);

        const countMap = new Map(counts.map(c => [c.fondId, c.dossierCount]));

        const itemsWithCount = result.items.map(item => ({
            ...item,
            dossierCount: countMap.get(item.id) || 0
        }));

        return {
            ...result,
            items: itemsWithCount
        };
    }
};
