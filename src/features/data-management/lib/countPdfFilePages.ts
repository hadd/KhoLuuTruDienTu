import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

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

export async function sumUploadPdfPages(files: Array<File>): Promise<number> {
  let total = 0
  for (const file of files) {
    total += await countPdfFilePages(file)
  }
  return total
}
