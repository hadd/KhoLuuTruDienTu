import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
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

    async delete(id: string) {
        const [dossierCount] = await db
            .select({ count: sql<number>`count(${dossiers.id})`.mapWith(Number) })
            .from(dossiers)
            .where(and(eq(dossiers.dossierTypeId, id), isNull(dossiers.deletedAt)));

        if (dossierCount && dossierCount.count > 0) {
            throw httpError.badRequest(
                "Không thể xóa loại hồ sơ vì đang có hồ sơ sử dụng loại này.",
            );
        }

        return crud.delete(id);
    },

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
