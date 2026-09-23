import { env } from "../../env.ts";
import type { PdfAConvertOptions } from "../pdf-a/pdf-a-converter.ts";
import { convertToPdfAInline } from "../pdf-a/pdf-a-converter.ts";
import {
  convertPdfToTiff,
  type PdfTiffConvertOptions,
} from "../pdf-tiff/pdf-to-tiff-converter.ts";
import {
  flattenPdfPagesToImages,
  type FlattenPdfOptions,
} from "../watermark/pdf-page-flattener.ts";

type JobKind = "tiff" | "flatten" | "pdfa-raster";

type JobMessage = {
  id: number;
  kind: JobKind;
  pdf: Uint8Array;
  dpi?: number;
  jpegQuality?: number;
  title?: string;
};

type JobResult = {
  id: number;
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
};

type PendingJob = {
  message: JobMessage;
  transfer: Transferable;
  resolve: (bytes: Uint8Array) => void;
  reject: (err: Error) => void;
};

type Slot = {
  worker: Worker;
  busy: boolean;
  current: PendingJob | null;
};

const slots: Slot[] = [];
const queue: PendingJob[] = [];
let nextId = 1;
let idleTimer: number | undefined;

export function shouldOffloadHeavyWork(): boolean {
  return Deno.env.get("NODE_ENV") !== "test";
}

function copyBytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(data);
}

function workerUrl(): string {
  return new URL("./cpu-worker.ts", import.meta.url).href;
}

function spawnSlot(): Slot {
  const worker = new Worker(workerUrl(), {
    type: "module",
    deno: { permissions: "inherit" },
  });
  const slot: Slot = { worker, busy: false, current: null };
  worker.onmessage = (event: MessageEvent<JobResult>) => {
    const pending = slot.current;
    slot.current = null;
    slot.busy = false;
    if (!pending || event.data.id !== pending.message.id) {
      scheduleIdleShutdown();
      dispatch();
      return;
    }
    if (event.data.ok && event.data.bytes) {
      pending.resolve(event.data.bytes);
    } else {
      pending.reject(new Error(event.data.error || "CPU worker failed"));
    }
    scheduleIdleShutdown();
    dispatch();
  };
  worker.onerror = (event) => {
    const pending = slot.current;
    slot.current = null;
    slot.busy = false;
    const message = event.message || "CPU worker crashed";
    pending?.reject(new Error(message));
    const index = slots.indexOf(slot);
    if (index >= 0) slots.splice(index, 1);
    try {
      worker.terminate();
    } catch {
      // already terminated
    }
    scheduleIdleShutdown();
    dispatch();
  };
  slots.push(slot);
  return slot;
}

function ensureCapacity() {
  const limit = env.EXPORT_WORKER_COUNT;
  while (slots.length < limit && slots.length < queue.length + busyCount()) {
    spawnSlot();
  }
  if (slots.length === 0 && limit > 0) spawnSlot();
}

function busyCount(): number {
  return slots.filter((slot) => slot.busy).length;
}

function dispatch() {
  ensureCapacity();
  for (const slot of slots) {
    if (slot.busy) continue;
    const job = queue.shift();
    if (!job) break;
    slot.busy = true;
    slot.current = job;
    slot.worker.postMessage(job.message, [job.transfer]);
  }
}

function scheduleIdleShutdown() {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    if (queue.length > 0 || busyCount() > 0) return;
    for (const slot of slots) {
      try {
        slot.worker.terminate();
      } catch {
        // already terminated
      }
    }
    slots.length = 0;
  }, 1000);
}

function enqueue(message: Omit<JobMessage, "id">): Promise<Uint8Array> {
  const pdf = copyBytes(message.pdf);
  const jobMessage: JobMessage = { ...message, id: nextId++, pdf };
  return new Promise((resolve, reject) => {
    queue.push({
      message: jobMessage,
      transfer: pdf.buffer as ArrayBuffer,
      resolve,
      reject,
    });
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
    dispatch();
  });
}

export function runConvertPdfToTiff(
  pdf: Uint8Array,
  options: PdfTiffConvertOptions = {},
): Promise<Uint8Array> {
  if (!shouldOffloadHeavyWork()) return convertPdfToTiff(pdf, options);
  return enqueue({
    kind: "tiff",
    pdf,
    dpi: options.dpi,
    jpegQuality: options.jpegQuality,
  });
}

export function runFlattenPdf(
  pdf: Uint8Array,
  options: FlattenPdfOptions = {},
): Promise<Uint8Array> {
  if (!shouldOffloadHeavyWork()) return flattenPdfPagesToImages(pdf, options);
  return enqueue({
    kind: "flatten",
    pdf,
    dpi: options.dpi,
    jpegQuality: options.jpegQuality,
  });
}

export function runPdfARaster(
  pdf: Uint8Array,
  options: PdfAConvertOptions = {},
): Promise<Uint8Array> {
  if (!shouldOffloadHeavyWork()) {
    return convertToPdfAInline(pdf, { ...options, forceRasterize: true });
  }
  return enqueue({
    kind: "pdfa-raster",
    pdf,
    dpi: options.dpi,
    title: options.title,
  });
}
