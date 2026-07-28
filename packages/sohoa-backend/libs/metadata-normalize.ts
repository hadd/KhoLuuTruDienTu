import type {
    DossierMetadata,
    MetadataDocumentItem,
    MetadataField,
    MetadataGroup,
    MetadataSourceDocument,
} from "./metadata-types.ts";
import { isDossierMetadata } from "./metadata-types.ts";

export const TAI_LIEU_LUU_TRU_GROUP_CODE = "TAI_LIEU_LUU_TRU";
export const HO_SO_LUU_TRU_GROUP_CODE = "HO_SO_LUU_TRU";
export const HO_SO_FOND_FIELD = "FOND";

export const ARCHIVAL_GROUP_CODES = new Set([
    HO_SO_LUU_TRU_GROUP_CODE,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
]);

export const TEN_LOAI_TAI_LIEU_FIELD = "TEN_LOAI_TAI_LIEU";

/** Legacy OCR document_types.id ↔ TT05 TEN_LOAI slug catalog codes. */
export const METADATA_CATALOG_GROUP_ALIASES: Record<string, readonly string[]> = {
    BAN_AN_QUYET_DINH: ["QUYET_DINH"],
    QUYET_DINH: ["BAN_AN_QUYET_DINH"],
    THI_HANH_XONG: ["BIEN_LAI"],
    BIEN_LAI: ["THI_HANH_XONG"],
    PHONG_LUU_TRU: [HO_SO_LUU_TRU_GROUP_CODE],
    HO_SO_LUU_TRU: ["PHONG_LUU_TRU"],
};

export function resolveCatalogGroupAliasCodes(groupCode: string): string[] {
    const aliases = METADATA_CATALOG_GROUP_ALIASES[groupCode] ?? [];
    return [groupCode, ...aliases];
}

function isValidBbox(box: unknown): box is number[] {
    if (!Array.isArray(box) || box.length !== 4) return false;
    return box.every((value) => Number.isFinite(Number(value)));
}

/** OCR TT05 uses `bboxes`; legacy/sample uses singular `bbox`. */
export function resolveMetadataFieldBbox(
    field: Pick<MetadataField, "bbox" | "bboxes">,
): number[] | null {
    if (isValidBbox(field.bbox)) {
        return field.bbox.map((value) => Number(value));
    }
    const first = field.bboxes?.[0];
    if (isValidBbox(first)) {
        return first.map((value) => Number(value));
    }
    return null;
}

function normalizeSourceDocument(
    raw: unknown,
): MetadataSourceDocument {
    if (!raw || typeof raw !== "object") {
        return { file_name: null, file_path: null };
    }
    const doc = raw as Record<string, unknown>;
    return {
        file_name: doc.file_name != null ? String(doc.file_name) : null,
        file_path: doc.file_path != null
            ? String(doc.file_path)
            : doc.filePath != null
            ? String(doc.filePath)
            : null,
    };
}

function normalizeMetadataField(raw: unknown): MetadataField {
    const field = (raw && typeof raw === "object"
        ? raw
        : {}) as Record<string, unknown>;
    const pageRaw = field.page;
    const page = pageRaw === null || pageRaw === undefined
        ? null
        : Number.isFinite(Number(pageRaw))
        ? Number(pageRaw)
        : null;

    const rawBbox = field.bbox;
    const rawBboxes = field.bboxes;

    return {
        name: String(field.name ?? ""),
        display: String(field.display ?? field.name ?? ""),
        type: String(field.type ?? "string"),
        value: field.value == null ? null : String(field.value),
        page,
        bbox: resolveMetadataFieldBbox({
            bbox: isValidBbox(rawBbox)
                ? rawBbox.map((value) => Number(value))
                : null,
            bboxes: Array.isArray(rawBboxes)
                ? rawBboxes.filter(isValidBbox).map((box) =>
                    box.map((value) => Number(value))
                )
                : null,
        }),
        bboxes: Array.isArray(field.bboxes)
            ? field.bboxes.filter(isValidBbox).map((box) =>
                box.map((value) => Number(value))
            )
            : undefined,
    };
}

function normalizeDocumentItem(raw: unknown): MetadataDocumentItem {
    const item = (raw && typeof raw === "object"
        ? raw
        : {}) as Record<string, unknown>;
    const fields = Array.isArray(item.fields)
        ? item.fields.map((field) => normalizeMetadataField(field))
        : [];
    return {
        source_document: normalizeSourceDocument(item.source_document),
        fields,
    };
}

function getNestedDocumentItems(
    group: MetadataGroup & { documents?: MetadataDocumentItem[]; document?: MetadataDocumentItem[] },
): MetadataDocumentItem[] | null {
    const raw = group.documents ?? group.document;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((item) => normalizeDocumentItem(item));
}

function normalizeMetadataGroup(group: MetadataGroup): MetadataGroup {
    const nestedDocuments = getNestedDocumentItems(group);
    if (nestedDocuments) {
        return {
            group_code: group.group_code,
            group_name: group.group_name,
            source_document: { file_name: null, file_path: null },
            fields: [],
            documents: nestedDocuments,
        };
    }

    return {
        group_code: group.group_code,
        group_name: group.group_name,
        source_document: normalizeSourceDocument(group.source_document),
        fields: Array.isArray(group.fields)
            ? group.fields.map((field) => normalizeMetadataField(field))
            : [],
    };
}

/** Expand `TAI_LIEU_LUU_TRU.documents[]` into flat groups (idempotent if already flat). */
export function expandTaiLieuDocuments(metadata: DossierMetadata): DossierMetadata {
    const expandedGroups: MetadataGroup[] = [];

    for (const group of metadata.metadata_groups.map(normalizeMetadataGroup)) {
        const nestedDocuments = getNestedDocumentItems(group);
        if (
            group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
            nestedDocuments &&
            nestedDocuments.length > 0
        ) {
            for (const item of nestedDocuments) {
                expandedGroups.push({
                    group_code: group.group_code,
                    group_name: group.group_name,
                    source_document: item.source_document,
                    fields: item.fields,
                });
            }
            continue;
        }

        expandedGroups.push({
            group_code: group.group_code,
            group_name: group.group_name,
            source_document: group.source_document,
            fields: group.fields,
        });
    }

    return { ...metadata, metadata_groups: expandedGroups };
}

/** Collapse consecutive flat `TAI_LIEU_LUU_TRU` groups into one group with `documents[]`. */
export function collapseTaiLieuDocuments(metadata: DossierMetadata): DossierMetadata {
    const collapsedGroups: MetadataGroup[] = [];
    let pendingTaiLieu: MetadataGroup | null = null;
    let pendingDocuments: MetadataDocumentItem[] = [];

    const flushTaiLieu = () => {
        if (!pendingTaiLieu || pendingDocuments.length === 0) return;
        collapsedGroups.push({
            group_code: pendingTaiLieu.group_code,
            group_name: pendingTaiLieu.group_name,
            source_document: { file_name: null, file_path: null },
            fields: [],
            documents: pendingDocuments,
        });
        pendingTaiLieu = null;
        pendingDocuments = [];
    };

    for (const group of metadata.metadata_groups) {
        const nestedDocuments = getNestedDocumentItems(group);
        if (nestedDocuments && nestedDocuments.length > 0) {
            flushTaiLieu();
            collapsedGroups.push({
                group_code: group.group_code,
                group_name: group.group_name,
                source_document: { file_name: null, file_path: null },
                fields: [],
                documents: nestedDocuments,
            });
            continue;
        }

        if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
            if (!pendingTaiLieu) {
                pendingTaiLieu = {
                    group_code: group.group_code,
                    group_name: group.group_name,
                    source_document: { file_name: null, file_path: null },
                    fields: [],
                };
            }
            pendingDocuments.push({
                source_document: normalizeSourceDocument(group.source_document),
                fields: Array.isArray(group.fields)
                    ? group.fields.map((field) => normalizeMetadataField(field))
                    : [],
            });
            continue;
        }

        flushTaiLieu();
        collapsedGroups.push({
            group_code: group.group_code,
            group_name: group.group_name,
            source_document: normalizeSourceDocument(group.source_document),
            fields: Array.isArray(group.fields)
                ? group.fields.map((field) => normalizeMetadataField(field))
                : [],
        });
    }

    flushTaiLieu();
    return { ...metadata, metadata_groups: collapsedGroups };
}

export function parseDossierMetadata(raw: unknown): DossierMetadata | null {
    if (!isDossierMetadata(raw)) return null;
    const normalized: DossierMetadata = {
        ho_so_id: raw.ho_so_id,
        trang_thai_ho_so: raw.trang_thai_ho_so,
        metadata_groups: raw.metadata_groups.map((group) =>
            normalizeMetadataGroup(group as MetadataGroup)
        ),
    };
    return expandTaiLieuDocuments(migrateTt05MetadataLayout(normalized));
}

export function formatDossierMetadataForStorage(
    metadata: DossierMetadata,
): DossierMetadata {
    return collapseTaiLieuDocuments(metadata);
}

/** Group code used in field catalog / allowedFields (TT05: slug from TEN_LOAI_TAI_LIEU). */
export function resolveMetadataGroupCatalogCode(group: MetadataGroup): string {
    if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
        const displayName = findMetadataFieldValue(
            group.fields,
            TEN_LOAI_TAI_LIEU_FIELD,
        );
        if (displayName) {
            return slugifyTenLoaiTaiLieu(displayName);
        }
    }

    return group.group_code;
}

export function findMetadataFieldValue(
    fields: MetadataField[],
    fieldName: string,
): string | null {
    const normalizedName = fieldName.trim().toUpperCase();
    for (const field of fields) {
        if (field.name.trim().toUpperCase() !== normalizedName) continue;
        const value = field.value?.trim();
        if (value) return value;
    }
    return null;
}

export function findHoSoFondFieldValue(
    metadata: DossierMetadata | null | undefined,
): string | null {
    const hoSoGroup = metadata?.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
    return findMetadataFieldValue(hoSoGroup?.fields ?? [], HO_SO_FOND_FIELD);
}

/** Slugify TEN_LOAI_TAI_LIEU display value → document_types.id (e.g. Quyết định → QUYET_DINH). */
export function slugifyTenLoaiTaiLieu(value: string): string {
    return value
        .replace(/đ/gi, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

const DEFAULT_FOND_VALUE =
    "Phông Cục Thi hành án dân sự tỉnh Phú Thọ";

const LEGACY_FOND_FIELD_NAMES = [
    "PHONG_LUU_TRU",
    "TEN_PHONG",
    "MA_PHONG",
] as const;

function isLegacyFondFieldName(fieldName: string): boolean {
    const normalized = fieldName.trim().toUpperCase();
    return LEGACY_FOND_FIELD_NAMES.some((name) => name === normalized);
}

function resolveLegacyFondValue(
    phongGroup: MetadataGroup | undefined,
    hoSoFields: MetadataField[],
): string {
    if (phongGroup) {
        return findMetadataFieldValue(phongGroup.fields, "TEN_PHONG") ??
            findMetadataFieldValue(phongGroup.fields, "MA_PHONG") ??
            DEFAULT_FOND_VALUE;
    }

    return findMetadataFieldValue(hoSoFields, HO_SO_FOND_FIELD) ??
        findMetadataFieldValue(hoSoFields, "PHONG_LUU_TRU") ??
        findMetadataFieldValue(hoSoFields, "TEN_PHONG") ??
        findMetadataFieldValue(hoSoFields, "MA_PHONG") ??
        DEFAULT_FOND_VALUE;
}

/** Drop PHONG_LUU_TRU group/field and normalize fond into HO_SO_LUU_TRU.FOND. */
export function migrateTt05MetadataLayout(metadata: DossierMetadata): DossierMetadata {
    const migrated = structuredClone(metadata) as DossierMetadata;

    const phongGroup = migrated.metadata_groups.find(
        (group) => group.group_code === "PHONG_LUU_TRU",
    );
    const hoSoGroup = migrated.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );

    const hasFondField = hoSoGroup?.fields.some(
        (field) => field.name.trim().toUpperCase() === HO_SO_FOND_FIELD,
    );
    const hasLegacyFondField = hoSoGroup?.fields.some((field) =>
        isLegacyFondFieldName(field.name)
    );

    if (!phongGroup && hasFondField && !hasLegacyFondField) {
        return migrated;
    }

    const fondValue = resolveLegacyFondValue(phongGroup, hoSoGroup?.fields ?? []);

    migrated.metadata_groups = migrated.metadata_groups.filter(
        (group) => group.group_code !== "PHONG_LUU_TRU",
    );

    const migratedHoSoGroup = migrated.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
    if (!migratedHoSoGroup) {
        return migrated;
    }

    const fields = (Array.isArray(migratedHoSoGroup.fields) ? migratedHoSoGroup.fields : [])
        .filter((field) =>
            field.name.trim().toUpperCase() !== HO_SO_FOND_FIELD &&
            !isLegacyFondFieldName(field.name)
        );
    const fondField: MetadataField = {
        name: HO_SO_FOND_FIELD,
        display: "Phông lưu trữ",
        type: "string",
        value: fondValue,
        page: null,
        bbox: null,
        bboxes: [],
    };

    fields.unshift(fondField);
    migratedHoSoGroup.fields = fields;

    return migrated;
}

export type DocumentTypeRef = {
    id: string;
    name: string;
};

function normalizeDocumentTypeId(raw: string | null | undefined): string | null {
    const id = raw?.trim();
    return id ? id : null;
}

function getNestedDocumentsForTypeSync(
    group: MetadataGroup,
): MetadataDocumentItem[] | null {
    const raw = group.documents ?? group.document;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw;
}

function addDocumentTypeRef(
    byId: Map<string, string>,
    id: string | null,
    name: string,
) {
    const normalizedId = normalizeDocumentTypeId(id);
    const normalizedName = name.trim();
    if (!normalizedId || !normalizedName) return;
    if (!byId.has(normalizedId)) byId.set(normalizedId, normalizedName);
}

function extractRefsFromTaiLieuDocuments(
    documents: MetadataDocumentItem[],
    byId: Map<string, string>,
) {
    for (const item of documents) {
        const displayName = findMetadataFieldValue(
            item.fields,
            TEN_LOAI_TAI_LIEU_FIELD,
        );
        if (!displayName) continue;
        addDocumentTypeRef(
            byId,
            slugifyTenLoaiTaiLieu(displayName),
            displayName,
        );
    }
}

export function extractDocumentTypeRefsFromMetadata(
    metadata: DossierMetadata,
): DocumentTypeRef[] {
    const byId = new Map<string, string>();

    for (const group of metadata.metadata_groups) {
        const nestedDocuments = getNestedDocumentsForTypeSync(group);
        if (
            group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
            nestedDocuments
        ) {
            extractRefsFromTaiLieuDocuments(nestedDocuments, byId);
            continue;
        }

        if (ARCHIVAL_GROUP_CODES.has(group.group_code)) {
            if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
                const displayName = findMetadataFieldValue(
                    group.fields,
                    TEN_LOAI_TAI_LIEU_FIELD,
                );
                if (displayName) {
                    addDocumentTypeRef(
                        byId,
                        slugifyTenLoaiTaiLieu(displayName),
                        displayName,
                    );
                }
            }
            continue;
        }

        const id = normalizeDocumentTypeId(group.group_code);
        if (!id) continue;
        const name = group.group_name?.trim() || id;
        addDocumentTypeRef(byId, id, name);
    }

    return [...byId.entries()].map(([id, name]) => ({ id, name }));
}
