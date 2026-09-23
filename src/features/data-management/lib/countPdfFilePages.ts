import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  mapWithConcurrency,
  PDF_PAGE_COUNT_CONCURRENCY,
} from '@/features/data-management/lib/uploadConcurrency'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Đếm số trang PDF phía client. File không phải PDF → 1. Lỗi đọc → 1. */
export async function countPdfFilePages(file: File): Promise<number> {
  if (!file.name.toLowerCase().endsWith('.pdf')) return 1

  try {
    const data = await file.arrayBuffer()
    const loadingTask = getDocument({ data })
    const doc = await loadingTask.promise
    try {
      return Math.max(1, doc.numPages || 1)
    } finally {
      await doc.destroy()
    }
  } catch {
    return 1
  }
}

export async function sumUploadPdfPages(
  files: Array<File>,
  options?: { signal?: AbortSignal },
): Promise<number> {
  const counts = await mapWithConcurrency(
    files,
    PDF_PAGE_COUNT_CONCURRENCY,
    (file) => countPdfFilePages(file),
    { signal: options?.signal },
  )
  return counts.reduce((sum, count) => sum + count, 0)
}
