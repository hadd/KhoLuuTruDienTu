import { assertEquals } from "@std/assert";
import PizZip from "pizzip";
import {
  fillCatalogTableInDocumentXml,
  isSampleCatalogRow,
  loadAppendixTemplate,
  normalizePl3DocumentXml,
  renderDocxTemplate,
} from "../modules/archive-disposal/disposal-appendix-docx.ts";

const sampleRow = {
  boxNumber: "1",
  volumeNumber: "2",
  title: "Hồ sơ mẫu",
  disposalReasonLabel: "Hết thời hạn lưu trữ",
  notes: "Ghi chú",
};

Deno.test("renderDocxTemplate fills PL II header placeholders", async () => {
  const template = await loadAppendixTemplate("phu-luc-ii-danh-muc.docx");
  const docx = renderDocxTemplate(template, {
    fondName: "Phông thử Ế",
    circularLabel: "06/2025/TT-BNV ngày 01 tháng 08 năm 2025",
  }, {
    tableRows: [sampleRow],
  });
  assertEquals(docx.length > 5000, true);
});

Deno.test("renderDocxTemplate injects catalog rows into real PL II template", async () => {
  const template = await loadAppendixTemplate("phu-luc-ii-danh-muc.docx");
  const docx = renderDocxTemplate(template, {
    fondName: "Phông thử",
    circularLabel: "06/2025/TT-BNV",
  }, {
    tableRows: [
      sampleRow,
      {
        boxNumber: "B2",
        volumeNumber: "T2",
        title: "HOSO-SECOND-ROW",
        disposalReasonLabel: "Trùng lặp",
        notes: "",
      },
    ],
  });
  const xml = new PizZip(docx).file("word/document.xml")!.asText();
  assertEquals(xml.includes("Hồ sơ mẫu"), true);
  assertEquals(xml.includes("HOSO-SECOND-ROW"), true);
  const dataRowCount = (xml.match(/Hồ sơ mẫu|HOSO-SECOND-ROW/g) ?? []).length;
  assertEquals(dataRowCount >= 2, true);
});

Deno.test("fillCatalogTableInDocumentXml injects row cells", () => {
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>
    <w:tr><w:tc><w:p><w:r><w:t>H</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Bó số</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Lý do hủy</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>(1)</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>(2)</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:tcPr></w:tcPr><w:p><w:pPr></w:pPr></w:p></w:tc><w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc></w:tr>
  </w:tbl></w:body></w:document>`;
  const out = fillCatalogTableInDocumentXml(xml, [{
    boxNumber: "B1",
    volumeNumber: "T1",
    title: "Tiêu đề",
    disposalReasonLabel: "Trùng lặp",
    notes: "N",
  }]);
  assertEquals(out.includes("B1"), true);
  assertEquals(out.includes("Tiêu đề"), true);
  assertEquals(out.includes(">(1)<"), false);
  assertEquals(out.includes(">(2)<"), false);
});

Deno.test("isSampleCatalogRow detects TT-BNV sample rows", () => {
  const singleCellSample = "<w:tr><w:tc><w:p><w:r><w:t>(1)</w:t></w:r></w:p></w:tc></w:tr>";
  const multiCellSample = `<w:tr>
    <w:tc><w:p><w:r><w:t>(1)</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>(2)</w:t></w:r></w:p></w:tc>
  </w:tr>`;
  const data = "<w:tr><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr>";
  assertEquals(isSampleCatalogRow(singleCellSample), true);
  assertEquals(isSampleCatalogRow(multiCellSample), true);
  assertEquals(isSampleCatalogRow(data), false);
});

Deno.test("renderDocxTemplate omits sample rows (1)/(2) from real PL II template", async () => {
  const template = await loadAppendixTemplate("phu-luc-ii-danh-muc.docx");
  const docx = renderDocxTemplate(template, {
    fondName: "Phông thử",
    circularLabel: "06/2025/TT-BNV",
  }, {
    tableRows: [{
      boxNumber: "B1",
      volumeNumber: "T1",
      title: "HOSO-REAL-ROW",
      disposalReasonLabel: "Trùng lặp",
      notes: "",
    }],
  });
  const xml = new PizZip(docx).file("word/document.xml")!.asText();
  assertEquals(xml.includes("HOSO-REAL-ROW"), true);
  assertEquals(xml.includes("B1"), true);
  assertEquals(xml.includes(">(1)<"), false);
  assertEquals(xml.includes(">(2)<"), false);
});

Deno.test("normalizePl3DocumentXml removes static labels and applies Word layout", async () => {
  const template = await loadAppendixTemplate("phu-luc-iii-thuyet-minh.docx");
  const raw = new PizZip(template).file("word/document.xml")!.asText();
  const normalized = normalizePl3DocumentXml(raw);
  assertEquals(
    normalized.includes("- Tổng số tài liệu đưa ra xác định lại giá trị</w:t></w:r></w:p>"),
    false,
  );
  assertEquals(normalized.includes('<w:jc w:val="both"'), true);
  assertEquals(normalized.includes("{formationHeading}"), true);
});

Deno.test("renderDocxTemplate PL III splits lines with justify and indents", async () => {
  const template = await loadAppendixTemplate("phu-luc-iii-thuyet-minh.docx");
  const docx = renderDocxTemplate(template, {
    fondName: "Phông A",
    circularLabel: "06/2025/TT-BNV",
    formationHeading: "1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp\n- Cơ quan A\n- Nhiệm vụ B",
    countsHeading: "2. Số lượng tài liệu:\n- Tổng: 1",
    timeRangeText: "3. Thời gian: 2020",
    expiredGroupSummary: "1. Nhóm tài liệu hết thời hạn lưu trữ:\nNội dung nhóm một.",
    duplicateGroupHeading: "2. Nhóm tài liệu trùng lặp",
    duplicateGroupSummary: "Nội dung nhóm hai.",
    otherGroupSummary: "3. Các nhóm tài liệu khác (nếu có):\nKhông.",
  }, { normalizePl3: true });
  const xml = new PizZip(docx).file("word/document.xml")!.asText();
  assertEquals(xml.includes('<w:jc w:val="both"'), true);
  assertEquals(xml.includes('w:val="32"'), true);
  assertEquals(xml.includes('w:val="24"'), true);
  assertEquals(xml.includes("Cơ quan A"), true);
  assertEquals(xml.includes("Nội dung nhóm một."), true);
  assertEquals(xml.includes('w:hanging="360"'), true);
  assertEquals(xml.includes("<w:t xml:space=\"preserve\">- </w:t>"), true);
});
