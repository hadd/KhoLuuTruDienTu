import { convertToPdfAInline } from "../pdf-a/pdf-a-converter.ts";
import { convertPdfToTiff } from "../pdf-tiff/pdf-to-tiff-converter.ts";
import { flattenPdfPagesToImages } from "../watermark/pdf-page-flattener.ts";

type CpuJob = {
  id: number;
  kind: "tiff" | "flatten" | "pdfa-raster";
  pdf: Uint8Array;
  dpi?: number;
  jpegQuality?: number;
  title?: string;
};

function standalone(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<CpuJob>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async (event: MessageEvent<CpuJob>) => {
  const job = event.data;
  try {
    let bytes: Uint8Array;
    if (job.kind === "tiff") {
      bytes = await convertPdfToTiff(job.pdf, {
        dpi: job.dpi,
        jpegQuality: job.jpegQuality,
      });
    } else if (job.kind === "flatten") {
      bytes = await flattenPdfPagesToImages(job.pdf, {
        dpi: job.dpi,
        jpegQuality: job.jpegQuality,
      });
    } else {
      bytes = await convertToPdfAInline(job.pdf, {
        forceRasterize: true,
        dpi: job.dpi,
        title: job.title,
      });
    }
    const out = standalone(bytes);
    scope.postMessage({ id: job.id, ok: true, bytes: out }, [
      out.buffer as ArrayBuffer,
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    scope.postMessage({ id: job.id, ok: false, error: message });
  }
};
