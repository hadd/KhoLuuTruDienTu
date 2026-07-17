import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

const FONT_URL = new URL("./fonts/NotoSans-Regular.ttf", import.meta.url);

let cachedFontBytes: Uint8Array | null = null;

async function getWatermarkFontBytes(): Promise<Uint8Array> {
  if (!cachedFontBytes) {
    cachedFontBytes = await Deno.readFile(FONT_URL);
  }
  return cachedFontBytes;
}

/** Embed a Unicode font that supports Vietnamese diacritics for watermark text. */
export async function embedWatermarkFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  pdfDoc.registerFontkit(fontkit);
  return await pdfDoc.embedFont(await getWatermarkFontBytes());
}
