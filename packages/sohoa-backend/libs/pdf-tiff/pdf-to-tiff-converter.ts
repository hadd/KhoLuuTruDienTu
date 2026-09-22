import * as mupdf from "mupdf";

export type PdfTiffConvertOptions = {
  dpi?: number;
  jpegQuality?: number;
};

const DEFAULT_DPI = 300;
const DEFAULT_JPEG_QUALITY = 95;

type JpegTiffPage = {
  width: number;
  height: number;
  dpi: number;
  jpeg: Uint8Array;
};

const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function encodeMultipageJpegTiff(pages: JpegTiffPage[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error("Cannot encode TIFF: no pages");
  }

  const chunks: Uint8Array[] = [];
  let offset = 8;

  const pageLayouts = pages.map((page) => {
    const jpegOffset = offset;
    chunks.push(page.jpeg);
    offset += page.jpeg.length;

    const bitsOffset = offset;
    const bits = new Uint8Array(6);
    const bitsView = new DataView(bits.buffer);
    writeUint16LE(bitsView, 0, 8);
    writeUint16LE(bitsView, 2, 8);
    writeUint16LE(bitsView, 4, 8);
    chunks.push(bits);
    offset += 6;

    const xResOffset = offset;
    const xRes = new Uint8Array(8);
    const xResView = new DataView(xRes.buffer);
    writeUint32LE(xResView, 0, page.dpi);
    writeUint32LE(xResView, 4, 1);
    chunks.push(xRes);
    offset += 8;

    const yResOffset = offset;
    const yRes = new Uint8Array(8);
    const yResView = new DataView(yRes.buffer);
    writeUint32LE(yResView, 0, page.dpi);
    writeUint32LE(yResView, 4, 1);
    chunks.push(yRes);
    offset += 8;

    return {
      page,
      jpegOffset,
      bitsOffset,
      xResOffset,
      yResOffset,
      ifdOffset: 0,
    };
  });

  for (const layout of pageLayouts) {
    layout.ifdOffset = offset;
    offset += 2 + 12 * 12 + 4;
  }

  const file = new Uint8Array(offset);
  const view = new DataView(file.buffer);

  file[0] = 0x49;
  file[1] = 0x49;
  writeUint16LE(view, 2, 42);
  writeUint32LE(view, 4, pageLayouts[0]!.ifdOffset);

  let writeAt = 8;
  for (const chunk of chunks) {
    file.set(chunk, writeAt);
    writeAt += chunk.length;
  }

  for (let i = 0; i < pageLayouts.length; i++) {
    const layout = pageLayouts[i]!;
    const { page, jpegOffset, bitsOffset, xResOffset, yResOffset, ifdOffset } =
      layout;
    const nextIfd = i + 1 < pageLayouts.length
      ? pageLayouts[i + 1]!.ifdOffset
      : 0;

    let p = ifdOffset;
    writeUint16LE(view, p, 12);
    p += 2;

    const writeEntry = (
      tag: number,
      type: number,
      count: number,
      valueOrOffset: number,
    ) => {
      writeUint16LE(view, p, tag);
      writeUint16LE(view, p + 2, type);
      writeUint32LE(view, p + 4, count);
      writeUint32LE(view, p + 8, valueOrOffset);
      p += 12;
    };

    writeEntry(256, TIFF_TYPE_LONG, 1, page.width);
    writeEntry(257, TIFF_TYPE_LONG, 1, page.height);
    writeEntry(258, TIFF_TYPE_SHORT, 3, bitsOffset);
    writeEntry(259, TIFF_TYPE_SHORT, 1, 7);
    writeEntry(262, TIFF_TYPE_SHORT, 1, 6);
    writeEntry(273, TIFF_TYPE_LONG, 1, jpegOffset);
    writeEntry(277, TIFF_TYPE_SHORT, 1, 3);
    writeEntry(278, TIFF_TYPE_LONG, 1, page.height);
    writeEntry(279, TIFF_TYPE_LONG, 1, page.jpeg.length);
    writeEntry(282, TIFF_TYPE_RATIONAL, 1, xResOffset);
    writeEntry(283, TIFF_TYPE_RATIONAL, 1, yResOffset);
    writeEntry(296, TIFF_TYPE_SHORT, 1, 2);

    writeUint32LE(view, p, nextIfd);
  }

  return file;
}

export function toTiffFileName(pdfFileName: string): string {
  if (/\.pdf$/i.test(pdfFileName)) {
    return pdfFileName.replace(/\.pdf$/i, ".TIFF");
  }
  return `${pdfFileName}.TIFF`;
}

/**
 * Rasterize each PDF page with mupdf and encode a multipage JPEG-compressed TIFF.
 */
export async function convertPdfToTiff(
  pdfBytes: Uint8Array,
  options: PdfTiffConvertOptions = {},
): Promise<Uint8Array> {
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error("Invalid PDF bytes: empty or undefined");
  }

  const dpi = options.dpi ?? DEFAULT_DPI;
  const jpegQuality = Math.min(
    95,
    Math.max(40, options.jpegQuality ?? DEFAULT_JPEG_QUALITY),
  );
  const scale = dpi / 72;

  const src = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  try {
    const pageCount = src.countPages();
    if (pageCount <= 0) {
      throw new Error("Cannot convert PDF to TIFF: document has no pages");
    }

    const pages: JpegTiffPage[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = src.loadPage(i);
      try {
        const bounds = page.getBounds() as [number, number, number, number];
        const pageWidth = Math.abs(bounds[2] - bounds[0]);
        const pageHeight = Math.abs(bounds[3] - bounds[1]);
        if (!(pageWidth > 0) || !(pageHeight > 0)) {
          throw new Error(
            `Invalid page bounds for TIFF convert (page=${i}, bounds=${bounds.join(",")})`,
          );
        }

        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false,
          true,
        );
        try {
          pixmap.setResolution(dpi, dpi);
          pages.push({
            width: pixmap.getWidth(),
            height: pixmap.getHeight(),
            dpi,
            jpeg: pixmap.asJPEG(jpegQuality),
          });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    }

    return encodeMultipageJpegTiff(pages);
  } finally {
    src.destroy();
  }
}

export async function convertBatchPdfToTiff(
  files: Array<{ fileName: string; data: Uint8Array }>,
  options: PdfTiffConvertOptions = {},
): Promise<Array<{ fileName: string; data: Uint8Array }>> {
  const results: Array<{ fileName: string; data: Uint8Array }> = [];
  for (const file of files) {
    const tiffBytes = await convertPdfToTiff(file.data, options);
    results.push({
      fileName: toTiffFileName(file.fileName),
      data: tiffBytes,
    });
  }
  return results;
}
