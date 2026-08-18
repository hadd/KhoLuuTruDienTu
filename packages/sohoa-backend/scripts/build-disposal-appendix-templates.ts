/**
 * One-time / maintenance: split master TT-BNV docx into print templates (no «Hướng dẫn cách ghi»).
 *
 * Usage (from packages/sohoa-backend):
 *   deno run --allow-read --allow-write scripts/build-disposal-appendix-templates.ts
 */
import JSZip from "jszip";

const MASTER = new URL(
  "../assets/Phu luc kem Thong tu 06.2025.TT-BNV.docx",
  import.meta.url,
);
const OUT_DIR = new URL(
  "../modules/archive-disposal/templates/",
  import.meta.url,
);

const PL2_TITLE = "DANH MỤC TÀI LIỆU HẾT THỜI HẠN LƯU TRỮ, TRÙNG LẶP";
const PL2_START = PL2_TITLE;
const PL2_END = "Hướng dẫn cách ghi:";
const PL3_START = "BẢN THUYẾT MINH TÀI LIỆU";

function isPl2TitleBlock(block: string): boolean {
  const t = blockText(block).replace(/\s+/g, " ").trim();
  return t === PL2_TITLE || t.startsWith(`${PL2_TITLE} `);
}

function isParagraphOpenAt(documentXml: string, index: number): boolean {
  if (!documentXml.startsWith("<w:p", index)) return false;
  const next = documentXml[index + 4];
  return next === ">" || next === " " || next === "/";
}

function isTableOpenAt(documentXml: string, index: number): boolean {
  if (!documentXml.startsWith("<w:tbl", index)) return false;
  const next = documentXml[index + 6];
  return next === ">" || next === " " || next === "/";
}

function extractBalancedBlock(
  documentXml: string,
  start: number,
  openPrefix: string,
  closeTag: string,
  isOpen: (xml: string, index: number) => boolean,
): { block: string; end: number } | null {
  if (!isOpen(documentXml, start)) return null;
  let depth = 1;
  let i = start + openPrefix.length;
  while (i < documentXml.length && depth > 0) {
    const nextOpen = documentXml.indexOf(openPrefix, i);
    const nextClose = documentXml.indexOf(closeTag, i);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose && isOpen(documentXml, nextOpen)) {
      depth++;
      i = nextOpen + openPrefix.length;
    } else {
      depth--;
      i = nextClose + closeTag.length;
    }
  }
  return depth === 0 ? { block: documentXml.slice(start, i), end: i } : null;
}

function findNextBlockStart(bodyInner: string, from: number): { start: number; kind: "p" | "tbl" } | null {
  let best: { start: number; kind: "p" | "tbl" } | null = null;
  for (const kind of ["p", "tbl"] as const) {
    const open = kind === "p" ? "<w:p" : "<w:tbl";
    const start = bodyInner.indexOf(open, from);
    if (start < 0) continue;
    const isOpen = kind === "p" ? isParagraphOpenAt : isTableOpenAt;
    if (!isOpen(bodyInner, start)) continue;
    if (!best || start < best.start) best = { start, kind };
  }
  return best;
}

function extractBodyBlocks(bodyInner: string): string[] {
  const blocks: string[] = [];
  let pos = 0;
  while (pos < bodyInner.length) {
    const next = findNextBlockStart(bodyInner, pos);
    if (!next) break;
    const openPrefix = next.kind === "p" ? "<w:p" : "<w:tbl";
    const closeTag = next.kind === "p" ? "</w:p>" : "</w:tbl>";
    const isOpen = next.kind === "p" ? isParagraphOpenAt : isTableOpenAt;
    const extracted = extractBalancedBlock(bodyInner, next.start, openPrefix, closeTag, isOpen);
    if (!extracted) break;
    blocks.push(extracted.block);
    pos = extracted.end;
  }
  return blocks;
}

function extractParagraphs(bodyInner: string): string[] {
  return extractBodyBlocks(bodyInner).filter((b) => b.startsWith("<w:p"));
}

function blockText(block: string): string {
  return [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1]!)
    .join("");
}

function includesTextBlock(block: string, needle: string): boolean {
  return blockText(block).includes(needle);
}

function filterPl2Blocks(blocks: string[]): string[] {
  const titleIdx = blocks.findIndex((b) => isPl2TitleBlock(b));
  if (titleIdx < 0) return [];
  let fromIdx = titleIdx;
  for (let i = titleIdx - 1; i >= 0; i--) {
    const t = blockText(blocks[i]!);
    if (t.includes("(Kèm theo Thông tư")) {
      fromIdx = i;
      break;
    }
  }
  const out: string[] = [];
  for (let i = fromIdx; i < blocks.length; i++) {
    const b = blocks[i]!;
    const t = blockText(b);
    if (t.includes("MẪU DANH MỤC") || t.trim() === "Phụ lục II") continue;
    if (includesTextBlock(b, PL2_END)) break;
    out.push(b);
  }
  return out;
}

function isPl3StaticCountsLabelBlock(block: string): boolean {
  const labels = [
    "- Tổng số tài liệu đưa ra xác định lại giá trị",
    "- Tổng số tài liệu giấy đưa ra chỉnh lý",
    "- Tài liệu giữ lại bảo quản",
    "- Tài liệu hết thời hạn lưu trữ, trùng lặp",
  ];
  const t = blockText(block).replace(/\s+/g, " ").trim();
  return labels.includes(t);
}

function filterPl3Blocks(blocks: string[]): string[] {
  const titleIdx = blocks.findIndex((b) => includesTextBlock(b, PL3_START));
  if (titleIdx < 0) return [];
  let fromIdx = titleIdx;
  for (let i = titleIdx - 1; i >= 0; i--) {
    const t = blockText(blocks[i]!);
    if (t.includes("Hướng dẫn cách ghi")) break;
    if (t.includes("(Kèm theo Thông tư")) {
      fromIdx = i;
      break;
    }
  }
  const out: string[] = [];
  for (let i = fromIdx; i < blocks.length; i++) {
    const b = blocks[i]!;
    const t = blockText(b);
    if (t.includes("MẪU BẢN THUYẾT MINH")) continue;
    if (/^Phụ lục III\s*$/i.test(t.trim())) continue;
    if (isPl3StaticCountsLabelBlock(b)) continue;
    out.push(b);
  }
  return out;
}

function circularBlocks(blocks: string[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const t = blockText(b);
    if (t.includes("(Kèm theo Thông tư") || t.includes("/TT-BNV") || t.includes("của Bộ trưởng Bộ Nội vụ")) {
      out.push(b);
    }
  }
  return out;
}

function applyReplacements(xml: string, appendix: "ii" | "iii" = "ii"): string {
  let out = xml
    .replace(
      /Phông \(khối\)\.+<\/w:t>/g,
      "Phông (khối): {fondName}</w:t>",
    )
    .replace(
      /…… \/2025\/TT-BNV ngày … tháng … năm 2025/g,
      "{circularLabel}",
    );
  if (appendix === "iii") {
    out = out
      .replace(
        /1\. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp/g,
        "{formationHeading}",
      )
      .replace(
        /2\. Số lượng tài liệu:/g,
        "{countsHeading}",
      )
      .replace(
        /3\. Thời gian: Thời gian bắt đầu và kết thúc của khối tài liệu hết thời hạn lưu trữ, trùng lặp/g,
        "{timeRangeText}",
      )
      .replace(
        /1\. Nhóm tài liệu hết thời hạn lưu trữ: Gồm những tài liệu gì\? Nội dung về vấn đề gì\? Tác giả\? Thời gian\?/g,
        "{expiredGroupSummary}",
      )
      .replace(
        /2\. Nhóm tài liệu trùng lặp/g,
        "{duplicateGroupHeading}",
      )
      .replace(/Gồm những tài liệu gì\?/g, "{duplicateGroupSummary}")
      .replace(
        /3\. Các nhóm tài liệu khác \(nếu có\): tài liệu có tình trạng vật lý kém không thể phục hồi[\s\S]*?\.\.\./g,
        "{otherGroupSummary}",
      );
  }
  return out;
}

function buildDocumentXml(masterDocumentXml: string, blocks: string[], appendix: "ii" | "iii"): string {
  const body = blocks.join("");
  const replaced = applyReplacements(body, appendix);
  const sectPrMatches = [...masterDocumentXml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)];
  const sectPr = sectPrMatches.at(-1)?.[0] ?? "<w:sectPr/>";
  return masterDocumentXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${replaced}${sectPr}</w:body>`,
  );
}

async function cloneDocxWithBody(
  masterBytes: Uint8Array,
  documentXml: string,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(masterBytes);
  zip.file("word/document.xml", documentXml);
  return await zip.generateAsync({ type: "uint8array" });
}

const masterBytes = await Deno.readFile(MASTER);
const masterZip = await JSZip.loadAsync(masterBytes);
const masterDoc = await masterZip.file("word/document.xml")!.async("string");
const bodyMatch = masterDoc.match(/<w:body>([\s\S]*)<\/w:sectPr>/);
if (!bodyMatch) throw new Error("Invalid document.xml");
const blocks = extractBodyBlocks(bodyMatch[1]!);
const pl2 = filterPl2Blocks(blocks);
const pl3 = filterPl3Blocks(blocks);

if (pl2.length === 0 || pl3.length === 0) {
  throw new Error("Could not split appendix sections");
}

await Deno.mkdir(OUT_DIR, { recursive: true });

const pl2Doc = buildDocumentXml(masterDoc, pl2, "ii");
const pl3Doc = buildDocumentXml(masterDoc, pl3, "iii");

const pl2Bytes = await cloneDocxWithBody(masterBytes, pl2Doc);
const pl3Bytes = await cloneDocxWithBody(masterBytes, pl3Doc);

await Deno.writeFile(new URL("phu-luc-ii-danh-muc.docx", OUT_DIR), pl2Bytes);
await Deno.writeFile(new URL("phu-luc-iii-thuyet-minh.docx", OUT_DIR), pl3Bytes);

console.log("Wrote templates:", pl2.length, "and", pl3.length, "paragraphs");
