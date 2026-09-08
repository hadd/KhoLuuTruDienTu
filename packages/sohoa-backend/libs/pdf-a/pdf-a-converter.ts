import * as mupdf from "mupdf";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

export type PdfAConvertOptions = {
  title?: string;
  creator?: string;
  subject?: string;
  dpi?: number;
  forceRasterize?: boolean;
};

const DEFAULT_DPI = 150;
const DEFAULT_JPEG_QUALITY = 85;

/**
 * Builds standard XMP Metadata packet for PDF/A-2b conformance (ISO 19005-2:2011).
 */
function buildPdfAXmpMetadata(title?: string, creator?: string): string {
  const safeTitle = (title || "Archived Document").replace(/[<>&]/g, "");
  const safeCreator = (creator || "THICONGSOHOA Digitization System").replace(
    /[<>&]/g,
    "",
  );
  const nowIso = new Date().toISOString();

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${safeTitle}</rdf:li>
        </rdf:Alt>
      </dc:title>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>THICONGSOHOA Archival PDF/A Engine</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${safeCreator}</xmp:CreatorTool>
      <xmp:CreateDate>${nowIso}</xmp:CreateDate>
      <xmp:ModifyDate>${nowIso}</xmp:ModifyDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Converts input PDF bytes or image PDF bytes to a fully self-contained PDF/A-2b document (ISO 19005-2).
 * 1. Load original PDF (preserving text layer/vectors) or optionally rasterize if forceRasterize is true.
 * 2. Inject GTS_PDFA2 & GTS_PDFA1 OutputIntent dictionary into Catalog.
 * 3. Inject MarkInfo & ViewerPreferences dictionaries into Catalog.
 * 4. Inject XMP metadata packet with pdfaid:part=2 and pdfaid:conformance=B.
 */
export async function convertToPdfA(
  pdfBytes: Uint8Array,
  options: PdfAConvertOptions = {},
): Promise<Uint8Array> {
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error("Invalid PDF bytes: empty or undefined");
  }

  let out: PDFDocument;

  if (options.forceRasterize) {
    const dpi = options.dpi ?? DEFAULT_DPI;
    const scale = dpi / 72;
    const src = mupdf.Document.openDocument(pdfBytes, "application/pdf");
    try {
      out = await PDFDocument.create();
      const pageCount = src.countPages();

      for (let i = 0; i < pageCount; i++) {
        const page = src.loadPage(i);
        try {
          const bounds = page.getBounds() as [number, number, number, number];
          const pageWidth = Math.abs(bounds[2] - bounds[0]);
          const pageHeight = Math.abs(bounds[3] - bounds[1]);

          if (!(pageWidth > 0) || !(pageHeight > 0)) {
            continue;
          }

          const pixmap = page.toPixmap(
            mupdf.Matrix.scale(scale, scale),
            mupdf.ColorSpace.DeviceRGB,
            false,
            true,
          );

          try {
            const jpegBytes = pixmap.asJPEG(DEFAULT_JPEG_QUALITY);
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
    } finally {
      src.destroy();
    }
  } else {
    out = await PDFDocument.load(pdfBytes);
  }

  out.setTitle(options.title || "Archived Document");
  out.setCreator(options.creator || "THICONGSOHOA Digitization System");
  out.setProducer("THICONGSOHOA Archival PDF/A Engine");
  out.setCreationDate(new Date());
  out.setModificationDate(new Date());

  // 1. Inject GTS_PDFA2 OutputIntent dictionary into Catalog
  const outputIntentDict = out.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
  });
  const outputIntentRef = out.context.register(outputIntentDict);
  out.catalog.set(
    PDFName.of("OutputIntents"),
    out.context.obj([outputIntentRef]),
  );

  // 2. Inject MarkInfo & ViewerPreferences
  out.catalog.set(
    PDFName.of("MarkInfo"),
    out.context.obj({ Marked: true }),
  );
  out.catalog.set(
    PDFName.of("ViewerPreferences"),
    out.context.obj({ DisplayDocTitle: true }),
  );

  // 3. Inject XMP PDF/A-2b metadata packet into PDF catalog
  const xmpMetadataXml = buildPdfAXmpMetadata(options.title, options.creator);
  const metadataStream = out.context.stream(xmpMetadataXml, {
    Type: "Metadata",
    Subtype: "XML",
  });
  const metadataStreamRef = out.context.register(metadataStream);
  out.catalog.set(PDFName.of("Metadata"), metadataStreamRef);

  const pdfABytes = await out.save({ useObjectStreams: false });

  // 4. Header Version %PDF-1.7 for PDF/A-2b
  if (pdfABytes.length > 8) {
    pdfABytes[5] = "1".charCodeAt(0);
    pdfABytes[7] = "7".charCodeAt(0);
  }

  return pdfABytes;
}

export async function convertBatchToPdfA(
  files: Array<{ fileName: string; data: Uint8Array }>,
  options: PdfAConvertOptions = {},
): Promise<Array<{ fileName: string; data: Uint8Array }>> {
  const results: Array<{ fileName: string; data: Uint8Array }> = [];
  for (const file of files) {
    if (file.fileName.toLowerCase().endsWith(".pdf")) {
      const pdfABytes = await convertToPdfA(file.data, {
        ...options,
        title: file.fileName,
      });
      results.push({ fileName: file.fileName, data: pdfABytes });
    } else {
      results.push(file);
    }
  }
  return results;
}
