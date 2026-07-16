/**
 * Seed document_types từ taxonomy OCR (group_code / group_name)
 * — single source of truth dùng chung OCR/Classifier/CL/kho.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { logger } from "./utils.ts";

/** Khớp packages/sohoa-backend/assets/sample_metadata.json */
export const OCR_DOCUMENT_TYPE_CATALOG = [
    { id: "BAN_AN_QUYET_DINH", name: "Bản án, quyết định" },
    { id: "QUYET_DINH", name: "Quyết định THA" },
    { id: "DUONG_SU", name: "Đương sự" },
    { id: "NGHIA_VU", name: "Nghĩa vụ thi hành án" },
    { id: "THI_HANH_XONG", name: "Thi hành xong (Biên lai)" },
    { id: "DINH_CHI", name: "Đình chỉ thi hành án" },
    { id: "UY_THAC_THA", name: "Ủy thác thi hành án" },
    { id: "NHAN_UY_THAC_THA", name: "Thông báo nhận ủy thác" },
    { id: "BAO_CAO_DOI_CHIEU", name: "Báo cáo đối chiếu (Mẫu 7)" },
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
