import { assertEquals, assertStringIncludes } from "@std/assert";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import { buildHosoXml, buildHosoXmlFromMetadata, mapMetadataToHosoFields } from "../libs/archival-package/field-mapper.ts";
import {
    resolveAipObjectKey,
    resolveAipZipFileName,
    resolveDipZipFileName,
    resolveHoSoId,
} from "../libs/archival-package/aip-path-utils.ts";
import { buildAipHosoPackage } from "../libs/archival-package/aip-hoso-builder.ts";
import { buildDipHosoPackage } from "../libs/archival-package/dip-hoso-builder.ts";
import { buildManifestLines, uniqueZipEntryName } from "../libs/archival-package/zip-utils.ts";

function sampleMetadata(): DossierMetadata {
    return {
        ho_so_id: "185_CD",
        metadata_groups: [{
            group_code: "BAN_AN",
            group_name: "Bản án",
            source_document: { file_name: "a.pdf", file_path: "raw/185/a.pdf" },
            fields: [
                { name: "TIEU_DE", display: "Tiêu đề", type: "string", value: "Hồ sơ test", page: null, bbox: null },
                { name: "THOI_HAN_LUU_TRU", display: "THLT", type: "string", value: "Vĩnh viễn", page: null, bbox: null },
            ],
        }],
    };
}

Deno.test("resolveHoSoId prefers metadata ho_so_id", () => {
    assertEquals(resolveHoSoId(sampleMetadata(), "fallback", "uuid-1"), "185_CD");
});

Deno.test("resolveAipObjectKey is deterministic", () => {
    const metadata = sampleMetadata();
    const key = resolveAipObjectKey({
        folderPath: "raw/batch1/185_CD",
        metadata,
        dossierName: "185_CD",
        dossierId: "uuid-1",
    });
    assertEquals(key, "aip/raw/batch1/185_CD/185_CD-AIP_hoso.zip");
});

Deno.test("resolveAipObjectKey mirrors dossier folderPath without duplicate segment", () => {
    const metadata = sampleMetadata();
    const key = resolveAipObjectKey({
        folderPath: "raw/2024/Q1/HS-001",
        metadata: { ...metadata, ho_so_id: "HS-001" },
        dossierName: "HS-001",
        dossierId: "uuid-1",
    });
    assertEquals(key, "aip/raw/2024/Q1/HS-001/HS-001-AIP_hoso.zip");
});

Deno.test("resolveAipZipFileName and resolveDipZipFileName", () => {
    assertEquals(resolveAipZipFileName("185_CD"), "185_CD-AIP_hoso.zip");
    assertEquals(resolveDipZipFileName("185_CD"), "185_CD-DIP_hoso.zip");
});

Deno.test("mapMetadataToHosoFields extracts core fields", () => {
    const fields = mapMetadataToHosoFields(sampleMetadata(), "185_CD");
    assertEquals(fields.maHoSo, "185_CD");
    assertEquals(fields.tieuDe, "Hồ sơ test");
    assertEquals(fields.thoiHanLuuTru, "Vĩnh viễn");
    assertEquals(fields.tongSoTaiLieu, 1);
});

Deno.test("buildHosoXmlFromMetadata includes all groups and fields", () => {
    const metadata: DossierMetadata = {
        ho_so_id: "185_CD",
        trang_thai_ho_so: "APPROVED",
        metadata_groups: [{
            group_code: "BAN_AN",
            group_name: "Bản án",
            source_document: { file_name: "a.pdf", file_path: "raw/185/a.pdf" },
            fields: [
                { name: "SO_BAN_AN", display: "Số bản án", type: "string", value: "50/2022", page: 1, bbox: [0, 0, 100, 20] },
                { name: "TIEU_DE", display: "Tiêu đề", type: "string", value: "Hồ sơ test", page: null, bbox: null },
            ],
        }],
    };

    const xml = buildHosoXmlFromMetadata(metadata, "185_CD", "AIP_hoso");
    assertStringIncludes(xml, "<MaNhom>BAN_AN</MaNhom>");
    assertStringIncludes(xml, "<MaTruong>SO_BAN_AN</MaTruong>");
    assertStringIncludes(xml, "<GiaTri>50/2022</GiaTri>");
    assertStringIncludes(xml, "<TenFile>a.pdf</TenFile>");
    assertStringIncludes(xml, "<TrangThaiHoSo>APPROVED</TrangThaiHoSo>");
});

Deno.test("buildHosoXml escapes special characters", () => {
    const xml = buildHosoXml({
        maHoSo: "A&B",
        tieuDe: "Test <title>",
        thoiHanLuuTru: null,
        tongSoTaiLieu: 1,
        ghiChu: null,
        ngonNgu: "vi",
        loaiTaiLieu: null,
    }, "AIP_hoso");
    assertStringIncludes(xml, "A&amp;B");
    assertStringIncludes(xml, "Test &lt;title&gt;");
    assertStringIncludes(xml, 'package="AIP_hoso"');
});

Deno.test("uniqueZipEntryName deduplicates filenames", () => {
    const used = new Set<string>();
    assertEquals(uniqueZipEntryName("doc.pdf", used), "doc.pdf");
    assertEquals(uniqueZipEntryName("doc.pdf", used), "doc (2).pdf");
});

Deno.test("buildManifestLines produces sha256 lines", async () => {
    const data = new TextEncoder().encode("hello");
    const lines = await buildManifestLines([{ path: "test.txt", data }]);
    assertEquals(lines.length, 1);
    assertStringIncludes(lines[0], "  test.txt");
    assertEquals(lines[0].split("  ")[0].length, 64);
});

Deno.test("buildAipHosoPackage produces zip with manifest", async () => {
    const pdfData = new TextEncoder().encode("%PDF-1.4 fake");
    const result = await buildAipHosoPackage({
        metadata: sampleMetadata(),
        hoSoId: "185_CD",
        pdfFiles: [{ fileName: "a.pdf", data: pdfData, groupCode: "BAN_AN" }],
    });

    assertEquals(result.filename, "185_CD-AIP_hoso.zip");
    assertEquals(result.buffer.length > 100, true);
    assertEquals(result.manifestLines.length >= 3, true);
});

Deno.test("buildDipHosoPackage produces zip", async () => {
    const pdfData = new TextEncoder().encode("%PDF-1.4 fake");
    const result = await buildDipHosoPackage({
        metadata: sampleMetadata(),
        hoSoId: "185_CD",
        pdfFiles: [{ fileName: "a.pdf", data: pdfData }],
    });

    assertEquals(result.filename, "185_CD-DIP_hoso.zip");
    assertEquals(result.buffer.length > 50, true);
});
