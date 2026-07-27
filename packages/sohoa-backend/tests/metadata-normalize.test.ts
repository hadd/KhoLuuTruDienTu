import { assertEquals } from "@std/assert";
import {
    collapseTaiLieuDocuments,
    expandTaiLieuDocuments,
    extractDocumentTypeRefsFromMetadata,
    findMetadataFieldValue,
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
    const raw = JSON.parse(await Deno.readTextFile(TT05_PATH));
    const parsed = parseDossierMetadata(raw);
    if (!parsed) throw new Error("expected parsed metadata");

    assertEquals(parsed.metadata_groups.length, 4);
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
    const raw = JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata;
    const expanded = expandTaiLieuDocuments(raw);
    const collapsed = collapseTaiLieuDocuments(expanded);

    assertEquals(collapsed.metadata_groups.length, 3);
    const taiLieu = collapsed.metadata_groups.find((group) =>
        group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE
    );
    assertEquals(taiLieu?.documents?.length, 2);
    assertEquals(taiLieu?.fields.length, 0);
});

Deno.test("extractDocumentTypeRefsFromMetadata uses TEN_LOAI_TAI_LIEU only", async () => {
    const raw = JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata;
    const refs = extractDocumentTypeRefsFromMetadata(raw);

    assertEquals(refs, [
        { id: "QUYET_DINH", name: "Quyết định" },
        { id: "BIEN_LAI", name: "Biên lai" },
    ]);
});

Deno.test("flattenOcrFields indexes TT05 document fields with bbox from bboxes", async () => {
    const raw = JSON.parse(await Deno.readTextFile(TT05_PATH)) as DossierMetadata;
    const fields = flattenOcrFields(raw);
    const maDinhDanh = fields.find((field) => field.name === "MA_DINH_DANH_TAI_LIEU");

    assertEquals(Boolean(maDinhDanh), true);
    assertEquals(maDinhDanh?.group_code, TAI_LIEU_LUU_TRU_GROUP_CODE);
    assertEquals(maDinhDanh?.bbox, [150, 100, 450, 120]);
    assertEquals(fields.some((field) => field.name === "MA_PHONG"), true);
});
