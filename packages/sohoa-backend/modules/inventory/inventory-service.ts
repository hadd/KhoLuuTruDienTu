import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, eq, isNull } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import {
    createInventorySchema,
    inventoryEntitySchema,
    updateInventorySchema,
} from "./types.ts";

const crud = createCrudService({
    db,
    table: inventories,
    searchable: ["id", "name", "number", "submittingUnit"],
    entitySchema: inventoryEntitySchema,
    createSchema: createInventorySchema,
    updateSchema: updateInventorySchema,
    metadata: {
        tags: ["Inventory"],
        descriptions: {
            list: "List inventories with pagination, filtering and search.",
            get: "Get an inventory by ID.",
            create: "Create an inventory record.",
            update: "Update an inventory record (cannot update ID).",
            delete: "Delete an inventory record.",
        },
    },
});

async function assertFondExists(fondId: string) {
    const [fond] = await db
        .select({ id: fonds.id })
        .from(fonds)
        .where(and(
            eq(fonds.id, fondId),
            eq(fonds.isActive, true),
            isNull(fonds.deletedAt),
        ))
        .limit(1);
    if (!fond) {
        throw httpError.badRequest("Phông lưu trữ không tồn tại hoặc đã ngưng hoạt động");
    }
}

export const InventoryService = {
    ...crud,

    async listActive() {
        const items = await db
            .select()
            .from(inventories)
            .where(eq(inventories.isActive, true))
            .orderBy(inventories.name);
        return { items };
    },

    async create(body: Static<typeof createInventorySchema>) {
        await assertFondExists(body.fondId);
        return crud.create({
            ...body,
            isActive: body.isActive ?? true,
        });
    },

    async update(id: string, body: Static<typeof updateInventorySchema>) {
        if (body.fondId !== undefined) {
            await assertFondExists(body.fondId);
        }
        return crud.update(id, body);
    },
};
