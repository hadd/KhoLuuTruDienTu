import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds, type Fond } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import {
    createFondSchema,
    fondEntitySchema,
    updateFondSchema,
} from "./types.ts";

type FondRow = Fond & { dossierCount?: number };

export type PublicFond = Fond & {
    dossierCount?: number;
};

function toPublicFond(row: FondRow): PublicFond {
    return row;
}

function mapPublicFonds(rows: unknown[]): PublicFond[] {
    return (rows as FondRow[]).map(toPublicFond);
}

const crud = createCrudService({
    db,
    table: fonds,
    searchable: ["id", "fondName", "archiveAgency", "fondType"],
    entitySchema: fondEntitySchema,
    createSchema: createFondSchema,
    updateSchema: updateFondSchema,
    mapRecord: mapPublicFonds,
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

    async create(input: {
        id: string;
        fondName: string;
        archiveAgency: string;
        adminstrativeHistory: string;
        fondType: string;
        isActive?: boolean;
    }) {
        const [row] = await db
            .insert(fonds)
            .values({
                ...input,
                isActive: input.isActive ?? true,
            })
            .returning();
        return toPublicFond(row!);
    },

    async update(
        id: string,
        input: {
            fondName?: string;
            archiveAgency?: string;
            adminstrativeHistory?: string;
            fondType?: string;
            isActive?: boolean;
        },
    ) {
        const existing = await db.query.fonds.findFirst({
            where: eq(fonds.id, id),
        });
        if (!existing || existing.deletedAt) {
            throw httpError.notFound("Không tìm thấy phông");
        }

        const [row] = await db
            .update(fonds)
            .set({
                ...input,
                updatedAt: new Date(),
            })
            .where(eq(fonds.id, id))
            .returning();
        return toPublicFond(row!);
    },

    async get(id: string) {
        return crud.get(id);
    },

    async delete(id: string) {
        const [dossierCount] = await db
            .select({ count: sql<number>`count(${dossiers.id})`.mapWith(Number) })
            .from(dossiers)
            .where(and(eq(dossiers.fondId, id), isNull(dossiers.deletedAt)));

        if (dossierCount && dossierCount.count > 0) {
            throw httpError.badRequest(
                "Không thể xóa phông vì đang có hồ sơ thuộc phông này.",
            );
        }

        const [inventoryCount] = await db
            .select({ count: sql<number>`count(${inventories.id})`.mapWith(Number) })
            .from(inventories)
            .where(eq(inventories.fondId, id));

        if (inventoryCount && inventoryCount.count > 0) {
            throw httpError.badRequest(
                "Không thể xóa phông vì đang có mục lục thuộc phông này.",
            );
        }

        return crud.delete(id);
    },

    async listActive() {
        const result = await db
            .select()
            .from(fonds)
            .where(and(
                eq(fonds.isActive, true),
                isNull(fonds.deletedAt),
            ))
            .orderBy(fonds.fondName);
        return { items: result.map(toPublicFond) };
    },

    async list(input: unknown) {
        const result = await crud.list(input as never);
        const fondIds = result.items.map((i: { id: string }) => i.id);

        if (fondIds.length === 0) {
            return {
                ...result,
                items: [],
            };
        }

        const counts = await db
            .select({
                fondId: dossiers.fondId,
                dossierCount: sql<number>`count(${dossiers.id})`.mapWith(Number),
            })
            .from(dossiers)
            .where(and(
                inArray(dossiers.fondId, fondIds),
                isNull(dossiers.deletedAt),
            ))
            .groupBy(dossiers.fondId);

        const countMap = new Map(counts.map((c) => [c.fondId, c.dossierCount]));

        const itemsWithCount = result.items.map((item) => ({
            ...item,
            dossierCount: countMap.get(item.id) || 0,
        }));

        return {
            ...result,
            items: itemsWithCount,
        };
    },

    async listActiveWithDossierCount() {
        // 1. Lấy danh sách phông đang hoạt động
        const result = await db
            .select()
            .from(fonds)
            .where(and(
                eq(fonds.isActive, true),
                isNull(fonds.deletedAt),
            ))
            .orderBy(fonds.fondName);

        const fondIds = result.map((i) => i.id);
        if (fondIds.length === 0) {
            return { items: [] };
        }

        // 2. Tính toán số lượng hồ sơ (dossierCount) tương ứng cho từng phông
        const counts = await db
            .select({
                fondId: dossiers.fondId,
                dossierCount: sql<number>`count(${dossiers.id})`.mapWith(Number),
            })
            .from(dossiers)
            .where(and(
                inArray(dossiers.fondId, fondIds),
                isNull(dossiers.deletedAt),
            ))
            .groupBy(dossiers.fondId);

        const countMap = new Map(counts.map((c) => [c.fondId, c.dossierCount]));

        // 3. Ghép dossierCount vào kết quả trả về
        const itemsWithCount = result.map((item) => ({
            ...item,
            dossierCount: countMap.get(item.id) || 0,
        }));

        return { items: itemsWithCount.map(toPublicFond) };
    },
};
