import { httpError } from "@shared/common-lib";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { metadataFields } from "../../db/schemas/metadata-field.ts";
import { env } from "../../env.ts";
import type {
    CreateMetadataFieldInput,
    MetadataFieldQuery,
    UpdateMetadataFieldInput,
} from "./types.ts";

/**
 * Khóa duy nhất xác định trường metadata không trùng lặp:
 * modeCode + '#' + (groupCode || '') + '#' + fieldCode
 */
const makeKey = (
    modeCode: string | null | undefined,
    groupCode: string | null | undefined,
    fieldCode: string,
) =>
    `${(modeCode || "").trim().toUpperCase()}#${(groupCode || "").trim().toUpperCase()}#${fieldCode.trim().toUpperCase()}`;

export const MetadataFieldService = {
    async list(query?: MetadataFieldQuery) {
        const conditions = [];

        const modeCode = query?.metadataExtractModeCode;
        if (modeCode !== undefined && modeCode !== "") {
            conditions.push(eq(metadataFields.metadataExtractModeCode, modeCode.trim()));
        }

        const groupCode = query?.groupCode;
        if (groupCode !== undefined && groupCode !== "") {
            conditions.push(eq(metadataFields.groupCode, groupCode.trim()));
        }

        const fieldCode = query?.fieldCode;
        if (fieldCode !== undefined && fieldCode !== "") {
            conditions.push(eq(metadataFields.fieldCode, fieldCode.trim().toUpperCase()));
        }

        const description = query?.description;
        if (description !== undefined && description !== "") {
            conditions.push(ilike(metadataFields.description, `%${description.trim()}%`));
        }

        const isHiddenRaw = query?.isHidden;
        if (isHiddenRaw !== undefined && isHiddenRaw !== "") {
            const isHiddenVal = typeof isHiddenRaw === "boolean"
                ? isHiddenRaw
                : isHiddenRaw === "true" || isHiddenRaw === "1";
            conditions.push(eq(metadataFields.isHidden, isHiddenVal));
        }

        if (query?.search && query.search.trim() !== "") {
            const searchPattern = `%${query.search.trim()}%`;
            conditions.push(
                or(
                    ilike(metadataFields.fieldCode, searchPattern),
                    ilike(metadataFields.description, searchPattern),
                    ilike(metadataFields.groupCode, searchPattern),
                ),
            );
        }

        let q = db
            .select()
            .from(metadataFields)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(asc(metadataFields.fieldCode))
            .$dynamic();

        if (query?.limit) {
            const limit = Math.max(1, Math.min(Number(query.limit) || 50, 500));
            q = q.limit(limit);
        }

        if (query?.offset) {
            const offset = Math.max(0, Number(query.offset) || 0);
            q = q.offset(offset);
        }

        return await q;
    },

    async getById(id: string) {
        const [item] = await db
            .select()
            .from(metadataFields)
            .where(eq(metadataFields.id, id))
            .limit(1);

        if (!item) {
            throw httpError.notFound("Metadata field not found");
        }

        return item;
    },

    async getActiveHiddenFields(query?: MetadataFieldQuery): Promise<string[]> {
        const rows = await this.list({
            ...query,
            isHidden: query?.isHidden !== undefined ? query.isHidden : true,
        });
        return rows.map((r) => r.fieldCode.trim().toUpperCase());
    },

    /**
     * Tạo mới hoặc cập nhật (Upsert) danh sách trường metadata theo mode.
     * Nhận danh sách trong `metadata` (hoặc `fields`). Nếu đã tồn tại (theo mode + group + field), sẽ update để tránh trùng lặp.
     */
    async create(input: CreateMetadataFieldInput) {
        const modeCode = input.metadataExtractModeCode?.trim();
        if (!modeCode) {
            throw httpError.badRequest("metadataExtractModeCode is required");
        }

        // Lấy danh sách items từ `metadata`, hoặc chính input nếu gửi 1 item lẻ
        const rawItems = input.metadata ?? (
            input.fieldCode
                ? [{
                    groupCode: input.groupCode,
                    fieldCode: input.fieldCode,
                    description: input.description,
                    isHidden: input.isHidden,
                }]
                : []
        );

        if (!Array.isArray(rawItems) || rawItems.length === 0) {
            throw httpError.badRequest("Danh sách metadata không được để trống");
        }

        // Chuẩn hóa danh sách
        const normalizedList: Array<{
            groupCode: string | null;
            fieldCode: string;
            description: string | null;
            isHidden: boolean;
        }> = [];

        for (const item of rawItems) {
            const rawFieldCode = item.fieldCode;
            if (!rawFieldCode || rawFieldCode.trim() === "") continue;

            const groupCode = item.groupCode?.trim() || null;
            normalizedList.push({
                groupCode,
                fieldCode: rawFieldCode.trim().toUpperCase(),
                description: item.description?.trim() || null,
                isHidden: item.isHidden ?? false,
            });
        }

        if (normalizedList.length === 0) {
            throw httpError.badRequest("Không tìm thấy fieldCode hợp lệ trong danh sách");
        }

        // Thực hiện Upsert trong 1 transaction an toàn
        return await db.transaction(async (tx) => {
            const existingRows = await tx
                .select()
                .from(metadataFields)
                .where(eq(metadataFields.metadataExtractModeCode, modeCode));

            const existingMap = new Map<string, typeof metadataFields.$inferSelect>();
            for (const row of existingRows) {
                existingMap.set(
                    makeKey(row.metadataExtractModeCode, row.groupCode, row.fieldCode),
                    row,
                );
            }

            const toInsert: Array<typeof metadataFields.$inferInsert> = [];
            const toUpdate: Array<{ id: string; description: string | null; isHidden: boolean }> = [];
            const resultRows: Array<typeof metadataFields.$inferSelect> = [];

            const seenKeys = new Set<string>();

            for (const item of normalizedList) {
                const key = makeKey(modeCode, item.groupCode, item.fieldCode);
                if (seenKeys.has(key)) continue; // Bỏ qua nếu bị trùng lặp ngay trong payload
                seenKeys.add(key);

                const existing = existingMap.get(key);
                if (existing) {
                    // Chỉ update nếu thực sự có dữ liệu thay đổi để giảm tải DB
                    if (existing.description !== item.description || existing.isHidden !== item.isHidden) {
                        toUpdate.push({
                            id: existing.id,
                            description: item.description,
                            isHidden: item.isHidden,
                        });
                    } else {
                        resultRows.push(existing);
                    }
                } else {
                    toInsert.push({
                        metadataExtractModeCode: modeCode,
                        groupCode: item.groupCode,
                        fieldCode: item.fieldCode,
                        description: item.description,
                        isHidden: item.isHidden,
                    });
                }
            }

            // 1. Chèn mới những trường chưa có
            if (toInsert.length > 0) {
                const inserted = await tx
                    .insert(metadataFields)
                    .values(toInsert)
                    .returning();
                resultRows.push(...inserted);
            }

            // 2. Cập nhật những trường có thay đổi
            if (toUpdate.length > 0) {
                const schemaName = env.DB_SCHEMA || "sohoa_app";
                const valueTuples = toUpdate.map(
                    (u) => sql`(${u.id}::uuid, ${u.description}::text, ${u.isHidden}::boolean)`
                );

                const updated = await tx.execute(sql`
                    UPDATE "${sql.raw(schemaName)}"."metadata_fields" AS m
                    SET
                        description = v.description,
                        is_hidden = v.is_hidden,
                        updated_at = now()
                    FROM (VALUES ${sql.join(valueTuples, sql`, `)}) AS v(id, description, is_hidden)
                    WHERE m.id = v.id
                    RETURNING 
                        m.id, 
                        m.metadata_extract_mode_code AS "metadataExtractModeCode", 
                        m.group_code AS "groupCode", 
                        m.field_code AS "fieldCode", 
                        m.description, 
                        m.is_hidden AS "isHidden", 
                        m.created_at AS "createdAt", 
                        m.updated_at AS "updatedAt";
                `);
                resultRows.push(...(updated as unknown as Array<typeof metadataFields.$inferSelect>));
            }

            return {
                mode: modeCode,
                totalInserted: toInsert.length,
                totalUpdated: toUpdate.length,
                items: resultRows,
            };
        });
    },

    async update(id: string, input: UpdateMetadataFieldInput) {
        const item = await this.getById(id);

        // Kiểm tra trùng lặp nếu có thay đổi trong bộ 3 (mode, group, field)
        const newKey = makeKey(
            input.metadataExtractModeCode ?? item.metadataExtractModeCode,
            input.groupCode ?? item.groupCode,
            input.fieldCode ?? item.fieldCode,
        );
        if (newKey !== makeKey(item.metadataExtractModeCode, item.groupCode, item.fieldCode)) {
            const rows = await this.list({
                metadataExtractModeCode: (input.metadataExtractModeCode ?? item.metadataExtractModeCode) || undefined,
                fieldCode: input.fieldCode ?? item.fieldCode,
            });
            if (rows.some((r) => r.id !== id && makeKey(r.metadataExtractModeCode, r.groupCode, r.fieldCode) === newKey)) {
                throw httpError.conflict("Trường metadata với mã này đã tồn tại trong chế độ bóc tách");
            }
        }

        const updatePayload: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (input.fieldCode !== undefined) {
            updatePayload.fieldCode = input.fieldCode.trim().toUpperCase();
        }

        if (input.metadataExtractModeCode !== undefined) {
            updatePayload.metadataExtractModeCode = input.metadataExtractModeCode?.trim() || null;
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
            .update(metadataFields)
            .set(updatePayload)
            .where(eq(metadataFields.id, id))
            .returning();

        return updated;
    },

    async delete(id: string) {
        const item = await this.getById(id);

        const [deleted] = await db
            .delete(metadataFields)
            .where(eq(metadataFields.id, id))
            .returning();

        return deleted ?? item;
    },
};
