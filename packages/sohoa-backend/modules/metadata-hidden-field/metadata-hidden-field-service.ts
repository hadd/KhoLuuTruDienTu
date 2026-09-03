import { db } from "../../db/db-conn.ts";
import { metadataHiddenFields } from "../../db/schemas/metadata-hidden-field.ts";
import { eq, desc, sql } from "drizzle-orm";

let isTableInitialized = false;

export async function ensureMetadataHiddenFieldsTable() {
    if (isTableInitialized) return;
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "sohoa_app"."metadata_hidden_fields" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "field_code" varchar(100) NOT NULL,
                "group_code" varchar(100),
                "description" varchar(255),
                "is_hidden" boolean DEFAULT true NOT NULL,
                "created_at" timestamp with time zone DEFAULT now() NOT NULL,
                "updated_at" timestamp with time zone DEFAULT now() NOT NULL
            );
        `);

        // Check if initial seed is needed
        const countRes = await db.execute(sql`SELECT count(*)::int as count FROM "sohoa_app"."metadata_hidden_fields"`);
        const rawCount = countRes[0] as { count?: number } | undefined;
        const count = rawCount?.count ?? 0;

        if (count === 0) {
            await db.execute(sql`
                INSERT INTO "sohoa_app"."metadata_hidden_fields" ("field_code", "description", "is_hidden")
                VALUES ('MA_HO_SO', 'Mã hồ sơ', true)
                ON CONFLICT DO NOTHING;
            `);
        }
        isTableInitialized = true;
    } catch (error) {
        console.error("[MetadataHiddenField] Failed to ensure table", error);
    }
}

export const MetadataHiddenFieldService = {
    async getAll() {
        await ensureMetadataHiddenFieldsTable();
        return db.select().from(metadataHiddenFields).orderBy(desc(metadataHiddenFields.createdAt));
    },

    async getActiveHiddenFields(): Promise<string[]> {
        await ensureMetadataHiddenFieldsTable();
        const rows = await db
            .select({ fieldCode: metadataHiddenFields.fieldCode })
            .from(metadataHiddenFields)
            .where(eq(metadataHiddenFields.isHidden, true));
        return rows.map((r: { fieldCode: string }) => r.fieldCode.trim().toUpperCase());
    },

    async create(input: {
        fieldCode: string;
        groupCode?: string | null;
        description?: string | null;
        isHidden?: boolean;
    }) {
        await ensureMetadataHiddenFieldsTable();
        const fieldCode = input.fieldCode.trim().toUpperCase();
        const groupCode = input.groupCode?.trim() || null;
        const description = input.description?.trim() || null;
        const isHidden = input.isHidden ?? true;

        const [created] = await db
            .insert(metadataHiddenFields)
            .values({
                fieldCode,
                groupCode,
                description,
                isHidden,
            })
            .returning();
        return created;
    },

    async update(
        id: string,
        input: {
            fieldCode?: string;
            groupCode?: string | null;
            description?: string | null;
            isHidden?: boolean;
        }
    ) {
        await ensureMetadataHiddenFieldsTable();
        const updatePayload: Record<string, unknown> = {
            updatedAt: new Date(),
        };
        if (input.fieldCode !== undefined) {
            updatePayload.fieldCode = input.fieldCode.trim().toUpperCase();
        }
        if (input.groupCode !== undefined) {
            updatePayload.groupCode = input.groupCode?.trim() || null;
        }
        if (input.description !== undefined) {
            updatePayload.description = input.description?.trim() || null;
        }
        if (input.isHidden !== undefined) {
            updatePayload.isHidden = input.isHidden;
        }

        const [updated] = await db
            .update(metadataHiddenFields)
            .set(updatePayload)
            .where(eq(metadataHiddenFields.id, id))
            .returning();
        return updated;
    },

    async delete(id: string) {
        await ensureMetadataHiddenFieldsTable();
        const [deleted] = await db
            .delete(metadataHiddenFields)
            .where(eq(metadataHiddenFields.id, id))
            .returning();
        return deleted;
    },
};
