import { assertEquals } from "@std/assert";
import {
    collapseTaiLieuDocuments,
    expandTaiLieuDocuments,
    extractDocumentTypeRefsFromMetadata,
    findMetadataFieldValue,
    HO_SO_FOND_FIELD,
    HO_SO_LUU_TRU_GROUP_CODE,
    migrateTt05MetadataLayout,
    parseDossierMetadata,
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

    assertEquals(
        migrated.metadata_groups.some((group) => group.group_code === "PHONG_LUU_TRU"),
        false,
    );
    assertEquals(
        findMetadataFieldValue(
            migrated.metadata_groups.find((group) =>
                group.group_code === HO_SO_LUU_TRU_GROUP_CODE
            )?.fields ?? [],
            HO_SO_FOND_FIELD,
        ),
        "Phong legacy",
    );
});
