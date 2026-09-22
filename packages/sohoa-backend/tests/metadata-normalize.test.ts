import { assertEquals } from "@std/assert";
import {
    collapseTaiLieuDocuments,
    expandTaiLieuDocuments,
    extractDocumentTypeRefsFromMetadata,
    findHoSoFondFieldValue,
    findMetadataFieldValue,
    FOND_FIELD_NAMES,
    hasHoSoFondField,
    HO_SO_FOND_FIELD,
    HO_SO_LUU_TRU_GROUP_CODE,
    migrateTt05MetadataLayout,
    parseDossierMetadata,
    propagateHoSoFondToDocuments,
    resolveMetadataFieldBbox,
    slugifyTenLoaiTaiLieu,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
} from "../libs/metadata-normalize.ts";
import { flattenOcrFields } from "../libs/flatten-ocr-fields.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

const TT05_PATH = new URL("../assets/TT05.json", import.meta.url);

Deno.test("resolveMetadataFieldBbox prefers bbox then bboxes[0]", () => {
    assertEquals(resolveMetadataFieldBbox({
        bbox: [1, 2, 3, 4],
        bboxes: [[9, 9, 9, 9]],
    }), [1, 2, 3, 4]);
    assertEquals(resolveMetadataFieldBbox({
        bbox: null,
        bboxes: [[10, 20, 30, 40]],
    }), [10, 20, 30, 40]);
    assertEquals(resolveMetadataFieldBbox({ bbox: null, bboxes: [] }), null);
});

Deno.test("slugifyTenLoaiTaiLieu maps Vietnamese labels to ids", () => {
    assertEquals(slugifyTenLoaiTaiLieu("Quyết định"), "QUYET_DINH");
    assertEquals(slugifyTenLoaiTaiLieu("Biên lai"), "BIEN_LAI");
});

Deno.test("parseDossierMetadata expands TT05 documents[]", async () => {
    const raw = migrateTt05MetadataLayout(
        JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata,
    );
    const parsed = parseDossierMetadata(raw);
    if (!parsed) throw new Error("expected parsed metadata");

    assertEquals(parsed.metadata_groups.length, 3);
    const taiLieuGroups = parsed.metadata_groups.filter((group) =>
        group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE
    );
    assertEquals(taiLieuGroups.length, 2);
    assertEquals(
        findMetadataFieldValue(taiLieuGroups[0]!.fields, "TEN_LOAI_TAI_LIEU"),
        "Quyết định",
    );
    assertEquals(
        findMetadataFieldValue(taiLieuGroups[1]!.fields, "TEN_LOAI_TAI_LIEU"),
        "Biên lai",
    );
});

Deno.test("collapseTaiLieuDocuments round-trips TT05 nested shape", async () => {
    const raw = migrateTt05MetadataLayout(
        JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata,
    );
    const expanded = expandTaiLieuDocuments(raw);
    const collapsed = collapseTaiLieuDocuments(expanded);

    assertEquals(collapsed.metadata_groups.length, 2);
    const taiLieu = collapsed.metadata_groups.find((group) =>
        group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE
    );
    assertEquals(taiLieu?.documents?.length, 2);
    assertEquals(taiLieu?.fields.length, 0);
});

Deno.test("extractDocumentTypeRefsFromMetadata uses TEN_LOAI_TAI_LIEU only", async () => {
    const raw = migrateTt05MetadataLayout(
        JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata,
    );
    const refs = extractDocumentTypeRefsFromMetadata(raw);

    assertEquals(refs, [
        { id: "QUYET_DINH", name: "Quyết định" },
        { id: "BIEN_LAI", name: "Biên lai" },
    ]);
});

Deno.test("flattenOcrFields indexes TT05 document fields with bbox from bboxes", async () => {
    const raw = migrateTt05MetadataLayout(
        JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata,
    );
    const fields = flattenOcrFields(raw);
    const maDinhDanh = fields.find((field) => field.name === "MA_DINH_DANH_TAI_LIEU");

    assertEquals(Boolean(maDinhDanh), true);
    assertEquals(maDinhDanh?.group_code, TAI_LIEU_LUU_TRU_GROUP_CODE);
    assertEquals(maDinhDanh?.bbox, [150, 100, 450, 120]);
    assertEquals(fields.some((field) => field.name === HO_SO_FOND_FIELD), true);
});

Deno.test("migrateTt05MetadataLayout is idempotent on migrated TT05 assets", () => {
    const migrated: DossierMetadata = {
        ho_so_id: "TT05_FAKE_01",
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: HO_SO_FOND_FIELD,
                        display: "Phong",
                        type: "string",
                        value: "Phong A",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };

    assertEquals(migrateTt05MetadataLayout(migrated), migrated);
});

Deno.test("migrateTt05MetadataLayout renames legacy PHONG_LUU_TRU field in HO_SO", () => {
    const raw: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: "PHONG_LUU_TRU",
                        display: "Phong",
                        type: "string",
                        value: "Phong legacy field",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };
    const migrated = migrateTt05MetadataLayout(raw);
    const hoSoGroup = migrated.metadata_groups.find((group) =>
        group.group_code === HO_SO_LUU_TRU_GROUP_CODE
    );

    assertEquals(
        hoSoGroup?.fields.some((field) => field.name === "PHONG_LUU_TRU"),
        false,
    );
    assertEquals(
        findMetadataFieldValue(hoSoGroup?.fields ?? [], HO_SO_FOND_FIELD),
        "Phong legacy field",
    );
});

Deno.test("migrateTt05MetadataLayout moves fond from legacy PHONG group", () => {
    const raw: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "PHONG_LUU_TRU",
                group_name: "Phong",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: "TEN_PHONG",
                        display: "Ten phong",
                        type: "string",
                        value: "Phong legacy",
                        page: null,
                        bbox: null,
                    },
                    {
                        name: "MA_PHONG",
                        display: "Phong So",
                        type: "string",
                        value: "028.25.04",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [],
            },
        ],
    };
    const migrated = migrateTt05MetadataLayout(raw);
    const hoSoFields = migrated.metadata_groups.find((group) =>
        group.group_code === HO_SO_LUU_TRU_GROUP_CODE
    )?.fields ?? [];

    assertEquals(
        migrated.metadata_groups.some((group) => group.group_code === "PHONG_LUU_TRU"),
        false,
    );
    assertEquals(
        findMetadataFieldValue(hoSoFields, HO_SO_FOND_FIELD),
        "Phong legacy",
    );
    assertEquals(findMetadataFieldValue(hoSoFields, "TEN_PHONG"), "Phong legacy");
    assertEquals(findMetadataFieldValue(hoSoFields, "MA_PHONG"), "028.25.04");
});

Deno.test("migrateTt05MetadataLayout keeps MA_PHONG beside FOND on HO_SO", () => {
    const raw: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: "TEN_PHONG",
                        display: "Ten phong",
                        type: "string",
                        value: "Hoi CCB",
                        page: null,
                        bbox: null,
                    },
                    {
                        name: "MA_PHONG",
                        display: "Phong So",
                        type: "string",
                        value: "028.25.04",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };
    const migrated = migrateTt05MetadataLayout(raw);
    const hoSoFields = migrated.metadata_groups.find((group) =>
        group.group_code === HO_SO_LUU_TRU_GROUP_CODE
    )?.fields ?? [];

    assertEquals(findMetadataFieldValue(hoSoFields, HO_SO_FOND_FIELD), "Hoi CCB");
    assertEquals(findMetadataFieldValue(hoSoFields, "MA_PHONG"), "028.25.04");
    assertEquals(findMetadataFieldValue(hoSoFields, "TEN_PHONG"), "Hoi CCB");
});

Deno.test("hasHoSoFondField identifies presence of Fond field correctly", () => {
    const tt05Meta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [{ name: HO_SO_FOND_FIELD, display: "Phong", type: "string", value: "", page: null, bbox: null }],
            },
        ],
    };
    const thiHanhAnMeta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "THI_HANH_AN",
                group_name: "Thi hanh an",
                source_document: { file_name: null, file_path: null },
                fields: [{ name: "SOTIEN_PHAI_THI_HANH", display: "So tien", type: "string", value: "300000", page: null, bbox: null }],
            },
        ],
    };

    assertEquals(hasHoSoFondField(tt05Meta), true);
    assertEquals(hasHoSoFondField(thiHanhAnMeta), false);
});

Deno.test("findHoSoFondFieldValue extracts fond from MA_PHONG, TEN_PHONG, or PHONG_LUU_TRU", () => {
    const maPhongMeta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "MA_PHONG", display: "Mã phông lưu trữ", type: "string", value: "P00005", page: null, bbox: null },
                ],
            },
        ],
    };
    assertEquals(findHoSoFondFieldValue(maPhongMeta), "P00005");

    const tenPhongMeta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Ho so",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "TEN_PHONG", display: "Tên phông", type: "string", value: "Sở Công Thương", page: null, bbox: null },
                ],
            },
        ],
    };
    assertEquals(findHoSoFondFieldValue(tenPhongMeta), "Sở Công Thương");

    const fallbackPhongGroupMeta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "PHONG_LUU_TRU",
                group_name: "Phông lưu trữ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "MA_PHONG", display: "Mã phông", type: "string", value: "P00009", page: null, bbox: null },
                ],
            },
        ],
    };
    assertEquals(findHoSoFondFieldValue(fallbackPhongGroupMeta), "P00009");
});

Deno.test("propagateHoSoFondToDocuments applies dossier fond to all documents in metadata", () => {
    const meta: DossierMetadata = {
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Hồ sơ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "MA_PHONG", display: "Mã phông", type: "string", value: "P00005", page: null, bbox: null },
                ],
            },
            {
                group_code: TAI_LIEU_LUU_TRU_GROUP_CODE,
                group_name: "Tài liệu",
                source_document: { file_name: "doc1.pdf", file_path: "raw/doc1.pdf" },
                fields: [
                    { name: "MA_PHONG", display: "Mã phông", type: "string", value: "", page: null, bbox: null },
                    { name: "TEN_LOAI_TAI_LIEU", display: "Loại", type: "string", value: "Quyết định", page: null, bbox: null },
                ],
            },
            {
                group_code: TAI_LIEU_LUU_TRU_GROUP_CODE,
                group_name: "Tài liệu 2",
                source_document: { file_name: "doc2.pdf", file_path: "raw/doc2.pdf" },
                fields: [
                    { name: "MA_PHONG", display: "Mã phông", type: "string", value: "OLD_VAL", page: null, bbox: null },
                ],
            },
        ],
    };

    const propagated = propagateHoSoFondToDocuments(meta);
    const doc1Fond = findMetadataFieldValue(propagated.metadata_groups[1].fields, "MA_PHONG");
    const doc2Fond = findMetadataFieldValue(propagated.metadata_groups[2].fields, "MA_PHONG");

    assertEquals(doc1Fond, "P00005");
    assertEquals(doc2Fond, "P00005");
});
