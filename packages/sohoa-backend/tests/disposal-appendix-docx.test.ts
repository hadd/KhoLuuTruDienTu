import { assertEquals } from "@std/assert";
import PizZip from "pizzip";
import {
  fillCatalogTableInDocumentXml,
  loadAppendixTemplate,
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
});
