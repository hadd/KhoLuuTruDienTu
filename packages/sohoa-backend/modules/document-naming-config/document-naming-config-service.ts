import { httpError } from "../../../../shared/common-lib/mod.ts";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { documentNamingConfigs } from "../../db/schemas/document-naming-config.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import {
    buildStaticMetadataNamingFieldOptions,
    mergeMetadataNamingFieldOptions,
} from "../../libs/document-naming-export.ts";
import {
    buildDocumentNamePreviewSamples,
    DOCUMENT_NAMING_FIELD_CATALOG,
    validateDocumentNamingSegments,
    type DocumentNamingSegment,
    type DocumentNamingTargetType,
} from "../../libs/document-naming-types.ts";
import {
    buildUnionExportFieldCatalog,
    extractDossierFileItems,
    resolveExportColumnValueForFile,
} from "../../libs/metadata-export-field-resolver.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import {
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
} from "../data-entry/data-entry-s3-utils.ts";

const DEFAULT_MOCK_METADATA: Record<string, string> = {
    // Phông / Cơ quan
    "HO_SO_LUU_TRU.MA_PHONG": "P00005",
    "HO_SO_LUU_TRU.FOND": "P00005",
    "HO_SO_LUU_TRU.PHONG_LUU_TRU": "P00005",
    "TAI_LIEU_LUU_TRU.MA_PHONG": "P00005",
    "TAI_LIEU_LUU_TRU.FOND": "P00005",
    "HO_SO_LUU_TRU.MA_CO_QUAN_LUU_TRU_LICH_SU": "CQ01",
    "HO_SO_LUU_TRU.MA_CO_QUAN_LUU_TRU": "CQ01",
    "HO_SO_LUU_TRU.MA_CO_QUAN": "CQ01",
    "TAI_LIEU_LUU_TRU.MA_CO_QUAN_LUU_TRU_LICH_SU": "CQ01",

    // Hồ sơ
    "HO_SO_LUU_TRU.MUC_LUC_SO": "07",
    "HO_SO_LUU_TRU.NAM_HINH_THANH_HO_SO": "1998",
    "TAI_LIEU_LUU_TRU.MUC_LUC_SO": "07",
    "HO_SO_LUU_TRU.MA_HO_SO": "0123",
    "HO_SO_LUU_TRU.MA_HO_SO_GOC_GIAY": "0123",
    "TAI_LIEU_LUU_TRU.MA_HO_SO": "0123",
    "HO_SO_LUU_TRU.SO_VA_KY_HIEU_HO_SO": "0123",
    "HO_SO_LUU_TRU.SO_KY_HIEU_HO_SO": "0123",
    "TAI_LIEU_LUU_TRU.SO_VA_KY_HIEU_HO_SO": "0123",
    "TAI_LIEU_LUU_TRU.SO_KY_HIEU_HO_SO": "0123",
    "HO_SO_LUU_TRU.TIEU_DE_HO_SO": "Hồ sơ mẫu",
    "HO_SO_LUU_TRU.TIEU_DE": "Hồ sơ mẫu",
    "TAI_LIEU_LUU_TRU.TIEU_DE_HO_SO": "Hồ sơ mẫu",
    "HO_SO_LUU_TRU.THOI_HAN_LUU_TRU": "Vĩnh viễn",
    "HO_SO_LUU_TRU.THOI_HAN_BAO_QUAN": "Vĩnh viễn",
    "HO_SO_LUU_TRU.THOI_GIAN_BAT_DAU": "1998-01-01",
    "HO_SO_LUU_TRU.THOI_GIAN_KET_THUC": "1998-12-31",
    "HO_SO_LUU_TRU.TONG_SO_VAN_BAN_TRONG_HO_SO": "10",
    "HO_SO_LUU_TRU.TONG_SO_TAI_LIEU_TRONG_HO_SO": "10",
    "HO_SO_LUU_TRU.TONG_SO_VAN_BAN": "10",
    "HO_SO_LUU_TRU.SO_TAI_LIEU": "10",
    "HO_SO_LUU_TRU.SO_LUONG_TO": "25",
    "HO_SO_LUU_TRU.SO_LUONG_TRANG": "50",

    // Tài liệu / Văn bản
    "TAI_LIEU_LUU_TRU.MA_DINH_DANH_TAI_LIEU": "VB001",
    "TAI_LIEU_LUU_TRU.MA_DINH_DANH_VAN_BAN": "VB001",
    "TAI_LIEU_LUU_TRU.MA_VAN_BAN": "VB001",
    "HO_SO_LUU_TRU.MA_DINH_DANH_VAN_BAN": "VB001",
    "TAI_LIEU_LUU_TRU.SO_THU_TU_VAN_BAN": "001",
    "TAI_LIEU_LUU_TRU.STT_VAN_BAN": "001",
    "TAI_LIEU_LUU_TRU.STT_VAN_BAN_TRONG_HO_SO": "001",
    "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU": "BC",
    "TAI_LIEU_LUU_TRU.TEN_LOAI_VAN_BAN": "BC",
    "TAI_LIEU_LUU_TRU.SO_CUA_VAN_BAN": "0001",
    "TAI_LIEU_LUU_TRU.SO_CUA_TAI_LIEU": "0001",
    "TAI_LIEU_LUU_TRU.SO_VAN_BAN": "0001",
    "BAN_AN_QUYET_DINH.SO_BAN_AN": "0001",
    "QUYET_DINH.SO_QD_THA": "0001",
    "TAI_LIEU_LUU_TRU.KY_HIEU_CUA_VAN_BAN": "BC-01",
    "TAI_LIEU_LUU_TRU.KY_HIEU_CUA_TAI_LIEU": "BC-01",
    "TAI_LIEU_LUU_TRU.KY_HIEU_VAN_BAN": "BC-01",
    "TAI_LIEU_LUU_TRU.NGAY": "21",
    "TAI_LIEU_LUU_TRU.THANG": "09",
    "TAI_LIEU_LUU_TRU.NAM": "1998",
    "TAI_LIEU_LUU_TRU.NGAY_THANG_NAM_BAN_HANH": "1998",
    "TAI_LIEU_LUU_TRU.NGAY_THANG_NAM_VAN_BAN": "1998",
    "BAN_AN_QUYET_DINH.NGAY_BAN_HANH_AN_QD": "1998",
    "QUYET_DINH.NGAY_QUYET_DINH": "1998",
    "TAI_LIEU_LUU_TRU.TEN_CO_QUAN_BAN_HANH": "UBND",
    "BAN_AN_QUYET_DINH.CO_QUAN_BAN_HANH": "UBND",
    "QUYET_DINH.CO_QUAN_BAN_HANH_QUYET_DINH": "UBND",
    "TAI_LIEU_LUU_TRU.TRICH_YEU_NOI_DUNG": "Báo cáo mẫu",
    "TAI_LIEU_LUU_TRU.MUC_DO_TIN_CAY": "Chính xác",
    "HO_SO_LUU_TRU.MUC_DO_TIN_CAY": "Chính xác",
    "TAI_LIEU_LUU_TRU.NGON_NGU": "Tiếng Việt",
    "HO_SO_LUU_TRU.NGON_NGU": "Tiếng Việt",
    "TAI_LIEU_LUU_TRU.TRANG_SO": "1",
    "TAI_LIEU_LUU_TRU.SO_LUONG_TRANG_CUA_VAN_BAN": "5",
    "TAI_LIEU_LUU_TRU.SO_LUONG_TRANG": "5",
    "HO_SO_LUU_TRU.SO_LUONG_TRANG_CUA_VAN_BAN": "5",
    "TAI_LIEU_LUU_TRU.LOAI_TAI_LIEU": "Văn bản giấy",
    "HO_SO_LUU_TRU.LOAI_TAI_LIEU": "Văn bản giấy",
    "HO_SO_LUU_TRU.CHE_DO_SU_DUNG": "Hạn chế",
    "TAI_LIEU_LUU_TRU.CHE_DO_SU_DUNG": "Hạn chế",
    "TAI_LIEU_LUU_TRU.MUC_DO_TIEP_CAN": "Hạn chế",
    "HO_SO_LUU_TRU.MUC_DO_TIEP_CAN": "Hạn chế",
    "HO_SO_LUU_TRU.TINH_TRANG_VAT_LY": "Bình thường",
    "TAI_LIEU_LUU_TRU.TINH_TRANG_VAT_LY": "Bình thường",
    "TAI_LIEU_LUU_TRU.TEP_TIN_TAI_LIEU": "sample.pdf",

    // Synthetic metadata fields
    "__stt": "001",
    "__file_stt": "001",
    "__file_count": "10",
    "__ho_so_id": "0123",
    "__file_path": "sample.pdf",
    "__file_name": "sample.pdf",
    "__file_identifier": "VB001",
    "__document_type_name": "BC",
    "__date_day": "21",
    "__date_month": "09",
    "__date_year": "1998",
};

function resolveMockMetadataValue(
    fieldKey: string,
    fond?: { id: string; fondName?: string | null; archiveAgency?: string | null } | null,
    dossier?: { name?: string | null } | null,
    fallbackValue?: string | null,
): string {
    // Fond ID
    if (
        fieldKey === "HO_SO_LUU_TRU.MA_PHONG" ||
        fieldKey === "TAI_LIEU_LUU_TRU.MA_PHONG" ||
        fieldKey === "HO_SO_LUU_TRU.FOND" ||
        fieldKey === "HO_SO_LUU_TRU.PHONG_LUU_TRU" ||
        fieldKey.endsWith(".MA_PHONG") ||
        fieldKey.endsWith(".FOND")
    ) {
        return fond?.id || "P00005";
    }

    if (fieldKey.endsWith(".TEN_PHONG") || fieldKey.endsWith(".FOND_NAME")) {
        return fond?.fondName || "Phông mẫu";
    }

    if (DEFAULT_MOCK_METADATA[fieldKey]) {
        return DEFAULT_MOCK_METADATA[fieldKey];
    }

    const pureKey = fieldKey.includes(".") ? fieldKey.split(".").pop()! : fieldKey;
    if (pureKey) {
        if (DEFAULT_MOCK_METADATA[`HO_SO_LUU_TRU.${pureKey}`]) {
            return DEFAULT_MOCK_METADATA[`HO_SO_LUU_TRU.${pureKey}`];
        }
        if (DEFAULT_MOCK_METADATA[`TAI_LIEU_LUU_TRU.${pureKey}`]) {
            return DEFAULT_MOCK_METADATA[`TAI_LIEU_LUU_TRU.${pureKey}`];
        }
        if (DEFAULT_MOCK_METADATA[pureKey]) {
            return DEFAULT_MOCK_METADATA[pureKey];
        }
    }

    if (fieldKey.includes("TIEU_DE") || fieldKey.includes("TEN_HO_SO")) {
        return dossier?.name || "Hồ sơ mẫu";
    }

    if (fallbackValue && fallbackValue.trim()) {
        return fallbackValue.trim();
    }

    return pureKey || "SAMPLE";
}

function mapConfig(row: {
    id: string;
    fondId: string;
    targetType: string;
    dossierId: string | null;
    segments: DocumentNamingSegment[];
    autoIncrementCounter: number;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        fondId: row.fondId,
        targetType: row.targetType as DocumentNamingTargetType,
        dossierId: row.dossierId,
        segments: row.segments,
        autoIncrementCounter: row.autoIncrementCounter,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function parseAutoIncrementStart(segments: DocumentNamingSegment[]): number {
    const autoSegment = segments.find((segment) => segment.source === "auto_increment");
    if (!autoSegment?.value) return 1;
    const parsed = Number.parseInt(autoSegment.value, 10);
    return Number.isFinite(parsed) ? parsed : 1;
}

export const DocumentNamingConfigService = {
    getFieldCatalog() {
        return {
            ...DOCUMENT_NAMING_FIELD_CATALOG,
            metadata: buildStaticMetadataNamingFieldOptions(),
        };
    },

    async getFieldCatalogForDossier(dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: and(eq(dossiers.id, dossierId), isNull(dossiers.deletedAt)),
            columns: { id: true, currentMetadataKey: true },
        });
        if (!dossier?.currentMetadataKey) {
            return this.getFieldCatalog();
        }

        try {
            const key = resolveMetadataJsonKey(dossier.currentMetadataKey);
            const raw = await downloadJsonFromStorage(key);
            if (!isDossierMetadata(raw)) {
                return this.getFieldCatalog();
            }
            const live = buildUnionExportFieldCatalog([raw]);
            return {
                ...DOCUMENT_NAMING_FIELD_CATALOG,
                metadata: mergeMetadataNamingFieldOptions(live),
            };
        } catch {
            return this.getFieldCatalog();
        }
    },

    async listDossierOptions(input: {
        fondId: string;
        search?: string;
        limit?: number;
    }) {
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const search = input.search?.trim();

        const rows = await db.query.dossiers.findMany({
            where: and(
                eq(dossiers.fondId, input.fondId),
                isNull(dossiers.deletedAt),
                search
                    ? or(
                        ilike(dossiers.name, `%${search}%`),
                        ilike(dossiers.folderPath, `%${search}%`),
                    )
                    : undefined,
            ),
            columns: {
                id: true,
                name: true,
                folderPath: true,
            },
            orderBy: desc(dossiers.updatedAt),
            limit,
        });

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            folderPath: row.folderPath,
        }));
    },

    async getConfig(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
    }) {
        await this.assertFondExists(input.fondId);
        if (input.targetType === "file") {
            if (!input.dossierId) {
                throw httpError.badRequest("dossierId is required for file naming config");
            }
            await this.assertDossierInFond(input.fondId, input.dossierId);
        }

        const row = await db.query.documentNamingConfigs.findFirst({
            where: and(
                eq(documentNamingConfigs.fondId, input.fondId),
                eq(documentNamingConfigs.targetType, input.targetType),
                input.targetType === "dossier"
                    ? isNull(documentNamingConfigs.dossierId)
                    : eq(documentNamingConfigs.dossierId, input.dossierId!),
                isNull(documentNamingConfigs.deletedAt),
            ),
        });

        if (!row) {
            return {
                fondId: input.fondId,
                targetType: input.targetType,
                dossierId: input.targetType === "file" ? input.dossierId ?? null : null,
                segments: [] as DocumentNamingSegment[],
                autoIncrementCounter: 1,
            };
        }

        return mapConfig(row);
    },

    async upsertConfig(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
        segments: DocumentNamingSegment[];
    }) {
        await this.assertFondExists(input.fondId);
        if (input.targetType === "file") {
            if (!input.dossierId) {
                throw httpError.badRequest("dossierId is required for file naming config");
            }
            await this.assertDossierInFond(input.fondId, input.dossierId);
        }

        try {
            validateDocumentNamingSegments(input.segments);
        } catch (error) {
            throw httpError.badRequest(
                error instanceof Error ? error.message : "Invalid naming segments",
            );
        }

        const existing = await db.query.documentNamingConfigs.findFirst({
            where: and(
                eq(documentNamingConfigs.fondId, input.fondId),
                eq(documentNamingConfigs.targetType, input.targetType),
                input.targetType === "dossier"
                    ? isNull(documentNamingConfigs.dossierId)
                    : eq(documentNamingConfigs.dossierId, input.dossierId!),
                isNull(documentNamingConfigs.deletedAt),
            ),
        });

        const autoIncrementCounter = parseAutoIncrementStart(input.segments);

        if (existing) {
            const [row] = await db.update(documentNamingConfigs)
                .set({
                    segments: input.segments,
                    autoIncrementCounter,
                    updatedAt: new Date(),
                })
                .where(eq(documentNamingConfigs.id, existing.id))
                .returning();
            return mapConfig(row);
        }

        const [row] = await db.insert(documentNamingConfigs).values({
            fondId: input.fondId,
            targetType: input.targetType,
            dossierId: input.targetType === "file" ? input.dossierId ?? null : null,
            segments: input.segments,
            autoIncrementCounter,
        }).returning();

        return mapConfig(row);
    },

    async preview(input: {
        fondId: string;
        targetType: DocumentNamingTargetType;
        dossierId?: string | null;
        segments: DocumentNamingSegment[];
    }) {
        await this.assertFondExists(input.fondId);

        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, input.fondId), isNull(fonds.deletedAt)),
        });
        if (!fond) {
            throw httpError.notFound("Fond not found");
        }

        let dossier: typeof dossiers.$inferSelect | null = null;
        if (input.dossierId) {
            dossier = await db.query.dossiers.findFirst({
                where: and(
                    eq(dossiers.id, input.dossierId),
                    eq(dossiers.fondId, input.fondId),
                    isNull(dossiers.deletedAt),
                ),
            }) ?? null;
        }

        try {
            validateDocumentNamingSegments(input.segments);
        } catch (error) {
            throw httpError.badRequest(
                error instanceof Error ? error.message : "Invalid naming segments",
            );
        }

        const autoIncrementStart = parseAutoIncrementStart(input.segments);
        const metadataValues = await this.resolvePreviewMetadataValues(
            fond,
            dossier,
            input.segments,
        );

        const previews = buildDocumentNamePreviewSamples({
            segments: input.segments,
            fond: {
                id: fond.id,
                fondName: fond.fondName,
                archiveAgency: fond.archiveAgency,
                fondType: fond.fondType,
            },
            dossier: dossier
                ? {
                    name: dossier.name,
                    folderPath: dossier.folderPath,
                    projectCode: dossier.projectCode,
                    dossierTypeId: dossier.dossierTypeId,
                }
                : {
                    name: "HS-001",
                    folderPath: "/sample",
                    projectCode: "DA01",
                    dossierTypeId: "sample-dossier-type",
                },
            file: {
                fileName: "sample.pdf",
                documentTypeId: "sample-type",
            },
            metadataValues,
            autoIncrementStart,
        });

        return { previews };
    },

    async resolvePreviewMetadataValues(
        fond: typeof fonds.$inferSelect | null,
        dossier: typeof dossiers.$inferSelect | null,
        segments: DocumentNamingSegment[],
    ): Promise<Record<string, string>> {
        const metadataSegments = segments.filter(
            (segment) => segment.source === "metadata_field" && segment.fieldKey,
        );
        if (metadataSegments.length === 0) {
            return {};
        }

        const segmentMap = new Map<string, DocumentNamingSegment>();
        for (const seg of metadataSegments) {
            if (seg.fieldKey && !segmentMap.has(seg.fieldKey)) {
                segmentMap.set(seg.fieldKey, seg);
            }
        }
        const metadataKeys = Array.from(segmentMap.keys());

        const metadataKey = dossier?.currentMetadataKey ?? dossier?.ocrMetadataKey;
        if (!metadataKey) {
            return Object.fromEntries(
                metadataKeys.map((key) => [
                    key,
                    resolveMockMetadataValue(key, fond, dossier, segmentMap.get(key)?.value),
                ]),
            );
        }

        try {
            const key = resolveMetadataJsonKey(metadataKey);
            const raw = await downloadJsonFromStorage(key);
            if (!isDossierMetadata(raw)) {
                return Object.fromEntries(
                    metadataKeys.map((k) => [
                        k,
                        resolveMockMetadataValue(k, fond, dossier, segmentMap.get(k)?.value),
                    ]),
                );
            }
            const fileItems = extractDossierFileItems(raw);
            const fileItem = fileItems[0] ?? {
                fileIndex: 1,
                sourceDocument: { file_name: null, file_path: null },
                groups: [],
            };
            const values: Record<string, string> = {};
            for (const fieldKey of metadataKeys) {
                const resolved = resolveExportColumnValueForFile(
                    raw,
                    fileItem,
                    { header: fieldKey, fieldKeys: [fieldKey], separator: "" },
                    {
                        dossierIndex: 0,
                        fileIndex: fileItem.fileIndex,
                        fileCount: fileItems.length,
                    },
                );
                values[fieldKey] = resolved || resolveMockMetadataValue(
                    fieldKey,
                    fond,
                    dossier,
                    segmentMap.get(fieldKey)?.value,
                );
            }
            return values;
        } catch {
            return Object.fromEntries(
                metadataKeys.map((k) => [
                    k,
                    resolveMockMetadataValue(k, fond, dossier, segmentMap.get(k)?.value),
                ]),
            );
        }
    },

    async assertFondExists(fondId: string) {
        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, fondId), isNull(fonds.deletedAt)),
            columns: { id: true },
        });
        if (!fond) {
            throw httpError.notFound("Fond not found");
        }
    },

    async assertDossierInFond(fondId: string, dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: and(
                eq(dossiers.id, dossierId),
                eq(dossiers.fondId, fondId),
                isNull(dossiers.deletedAt),
            ),
            columns: { id: true },
        });
        if (!dossier) {
            throw httpError.notFound("Dossier not found in fond");
        }
    },

    async loadFileNamingExportContext(input: {
        fondId: string | null | undefined;
        dossierId: string;
        dossier: {
            name: string;
            folderPath: string;
            projectCode: string | null;
            dossierTypeId: string | null;
        };
    }) {
        if (!input.fondId) return null;

        const config = await this.getConfig({
            fondId: input.fondId,
            targetType: "file",
            dossierId: input.dossierId,
        });
        if (config.segments.length === 0) return null;

        const fond = await db.query.fonds.findFirst({
            where: and(eq(fonds.id, input.fondId), isNull(fonds.deletedAt)),
            columns: {
                id: true,
                fondName: true,
                archiveAgency: true,
                fondType: true,
            },
        });

        return {
            segments: config.segments,
            autoIncrementCounter: config.autoIncrementCounter,
            fond: fond
                ? {
                    id: fond.id,
                    fondName: fond.fondName,
                    archiveAgency: fond.archiveAgency,
                    fondType: fond.fondType,
                }
                : undefined,
            dossier: {
                name: input.dossier.name,
                folderPath: input.dossier.folderPath,
                projectCode: input.dossier.projectCode,
                dossierTypeId: input.dossier.dossierTypeId,
            },
        };
    },
};
