import * as mupdf from "mupdf";
import { PDFDocument } from "pdf-lib";

/** Default DPI balances print quality vs export ZIP size. */
const DEFAULT_DPI = 150;
const MIN_DPI = 72;
const MAX_DPI = 300;
const DEFAULT_JPEG_QUALITY = 85;

export type FlattenPdfOptions = {
  dpi?: number;
  jpegQuality?: number;
};

/**
 * Read at call time so tests/ops can toggle without reloading the process.
 * Default: enabled (true).
 */
export function isWatermarkFlattenEnabled(): boolean {
  const raw = Deno.env.get("WATERMARK_FLATTEN_ENABLED");
  if (raw === undefined || raw === null || raw.trim() === "") return true;
  const normalized = raw.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return true;
}

export function getWatermarkFlattenDpi(): number {
  const raw = Deno.env.get("WATERMARK_FLATTEN_DPI");
  if (raw === undefined || raw === null || raw.trim() === "") return DEFAULT_DPI;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DPI;
  return Math.min(MAX_DPI, Math.max(MIN_DPI, n));
}

/**
 * Rasterize every page to a JPEG image and rebuild a PDF so stamped
 * watermarks are no longer separate selectable/deletable objects
 * (e.g. after "Open with Google Docs").
 */
export async function flattenPdfPagesToImages(
  pdfBytes: Uint8Array,
  options: FlattenPdfOptions = {},
): Promise<Uint8Array> {
  const dpi = options.dpi ?? getWatermarkFlattenDpi();
  const jpegQuality = Math.min(
    95,
    Math.max(40, options.jpegQuality ?? DEFAULT_JPEG_QUALITY),
  );
  const scale = dpi / 72;

  const src = mupdf.Document.openDocument(
    new Uint8Array(pdfBytes),
    "application/pdf",
  );

  try {
    const out = await PDFDocument.create();
    const pageCount = src.countPages();

    for (let i = 0; i < pageCount; i++) {
      const page = src.loadPage(i);
      try {
        const bounds = page.getBounds() as [number, number, number, number];
        const pageWidth = Math.abs(bounds[2] - bounds[0]);
        const pageHeight = Math.abs(bounds[3] - bounds[1]);
        if (!(pageWidth > 0) || !(pageHeight > 0)) {
          throw new Error(
            `Invalid page bounds for flatten (page=${i}, bounds=${bounds.join(",")})`,
          );
        }

        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false,
          true,
        );
        try {
          const jpegBytes = pixmap.asJPEG(jpegQuality);
          const embedded = await out.embedJpg(jpegBytes);
          const newPage = out.addPage([pageWidth, pageHeight]);
          newPage.drawImage(embedded, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    }

    return await out.save();
  } finally {
    src.destroy();
  }
}
