import { createCrudService } from "@shared/base-crud";
import { httpError, logApi } from "@shared/common-lib";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds, type Fond } from "../../db/schemas/fond.ts";
import { inventories } from "../../db/schemas/inventory.ts";
import {
    decryptPassword,
    encryptPassword,
} from "../../libs/email-crypto.ts";
import {
    createFondSchema,
    fondEntitySchema,
    updateFondSchema,
} from "./types.ts";

type FondRow = Fond & { dossierCount?: number };

export type PublicFond = Omit<Fond, "zipPasswordEncrypted"> & {
    hasZipPassword: boolean;
    dossierCount?: number;
};

function toPublicFond(row: FondRow): PublicFond {
    const { zipPasswordEncrypted: _secret, ...rest } = row;
    return {
        ...rest,
        hasZipPassword: Boolean(row.zipPasswordEncrypted),
    };
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

async function resolveZipPasswordEncrypted(
    zipPassword: string | null | undefined,
    mode: "create" | "update",
): Promise<string | null | undefined> {
    if (mode === "create") {
        const plain = zipPassword?.trim();
        if (!plain) return null;
        return await encryptPassword(plain);
    }
    // update: omit => keep; null/"" => clear; non-empty => replace
    if (zipPassword === undefined) return undefined;
    if (zipPassword === null || zipPassword.trim() === "") return null;
    return await encryptPassword(zipPassword.trim());
}

export const FondService = {
    ...crud,

    async create(input: {
        id: string;
        fondName: string;
        archiveAgency: string;
        adminstrativeHistory: string;
        fondType: string;
        isActive?: boolean;
        zipPasswordEnabled?: boolean;
        zipPassword?: string | null;
    }) {
        const { zipPassword, zipPasswordEnabled, ...fields } = input;
        const zipPasswordEncrypted = await resolveZipPasswordEncrypted(
            zipPassword,
            "create",
        );
        const hasPassword = Boolean(zipPasswordEncrypted);
        if (zipPasswordEnabled === true && !hasPassword) {
            throw httpError.badRequest(
                "Cần nhập mật khẩu ZIP trước khi bật mật khẩu ZIP cho phông",
            );
        }
        const [row] = await db
            .insert(fonds)
            .values({
                ...fields,
                isActive: fields.isActive ?? true,
                zipPasswordEncrypted: zipPasswordEncrypted ?? null,
                zipPasswordEnabled: zipPasswordEnabled === true && hasPassword,
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
            zipPasswordEnabled?: boolean;
            zipPassword?: string | null;
        },
    ) {
        const existing = await db.query.fonds.findFirst({
            where: eq(fonds.id, id),
        });
        if (!existing || existing.deletedAt) {
            throw httpError.notFound("Không tìm thấy phông");
        }

        const { zipPassword, zipPasswordEnabled, ...fields } = input;
        const zipPasswordEncrypted = await resolveZipPasswordEncrypted(
            zipPassword,
            "update",
        );

        const nextHasPassword = zipPasswordEncrypted !== undefined
            ? Boolean(zipPasswordEncrypted)
            : Boolean(existing.zipPasswordEncrypted);

        if (zipPasswordEnabled === true && !nextHasPassword) {
            throw httpError.badRequest(
                "Cần nhập mật khẩu ZIP trước khi bật mật khẩu ZIP cho phông",
            );
        }

        const patch: Record<string, unknown> = {
            ...fields,
            updatedAt: new Date(),
        };
        if (zipPasswordEncrypted !== undefined) {
            patch.zipPasswordEncrypted = zipPasswordEncrypted;
            // Clearing the password forces the toggle off.
            if (!zipPasswordEncrypted) {
                patch.zipPasswordEnabled = false;
            }
        }
        if (zipPasswordEnabled !== undefined) {
            patch.zipPasswordEnabled = zipPasswordEnabled && nextHasPassword;
        }

        const [row] = await db
            .update(fonds)
            .set(patch)
            .where(eq(fonds.id, id))
            .returning();
        return toPublicFond(row!);
    },

    async get(id: string) {
        const result = await crud.get(id);
        // mapRecord already applied by crud; ensure shape if raw
        if (result && typeof result === "object" && "zipPasswordEncrypted" in result) {
            return toPublicFond(result as FondRow);
        }
        return result;
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
};

/**
 * Resolve ZIP password when all dossiers share one fond that has a password.
 * Returns undefined when mixed fonds / missing password.
 */
export async function resolveFondZipPasswordForExport(
    fondIds: Array<string | null | undefined>,
    applyWatermark: boolean,
): Promise<string | undefined> {
    if (!applyWatermark) return undefined;

    const unique = [
        ...new Set(
            fondIds
                .map((id) => id?.trim())
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    if (unique.length === 0) return undefined;
    if (unique.length > 1) {
        logApi.warn(
            { fondIds: unique },
            "[export] Skip ZIP password: export spans multiple fonds",
        );
        return undefined;
    }

    const fond = await db.query.fonds.findFirst({
        where: eq(fonds.id, unique[0]!),
    });
    if (!fond?.zipPasswordEnabled || !fond.zipPasswordEncrypted) return undefined;

    try {
        return await decryptPassword(fond.zipPasswordEncrypted);
    } catch (err) {
        logApi.error({ err, fondId: fond.id }, "[export] Failed to decrypt fond ZIP password");
        throw httpError.internal("Không giải mã được mật khẩu ZIP của phông");
    }
}
