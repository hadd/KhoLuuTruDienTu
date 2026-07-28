/**
 * Seed document_types từ taxonomy OCR (group_code / group_name)
 * — single source of truth dùng chung OCR/Classifier/CL/kho.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { logger } from "./utils.ts";

/** Khớp packages/sohoa-backend/assets/TT05.json */
export const OCR_DOCUMENT_TYPE_CATALOG = [
    { id: "PHONG_LUU_TRU", name: "Metadata cấp Phông lưu trữ" },
    { id: "HO_SO_LUU_TRU", name: "Metadata cấp Hồ sơ lưu trữ" },
    { id: "TAI_LIEU_LUU_TRU", name: "Metadata cấp Tài liệu lưu trữ" },
    { id: "QUYET_DINH", name: "Quyết định" },
    { id: "BIEN_LAI", name: "Biên lai" },
] as const;

export async function seedDocumentTypes(db: PostgresJsDatabase<any>) {
    logger.info("Seeding document_types (OCR group_code / group_name)...");
    const now = new Date();
    await db
        .insert(documentTypes)
        .values(
            OCR_DOCUMENT_TYPE_CATALOG.map((item) => ({
                id: item.id,
                name: item.name,
                description: "Seeded from OCR metadata taxonomy",
                isActive: true,
                createdAt: now,
                updatedAt: now,
            })),
        )
        .onConflictDoUpdate({
            target: documentTypes.id,
            set: {
                name: sql`excluded.name`,
                updatedAt: now,
            },
        });
    logger.info(`✅ document_types: ${OCR_DOCUMENT_TYPE_CATALOG.length} rows`);
}
