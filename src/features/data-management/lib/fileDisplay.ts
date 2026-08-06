import type { LucideIcon } from 'lucide-react'
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react'

import { PdfFileIcon } from '@/features/data-management/components/PdfFileIcon'

type TreeFileIcon = LucideIcon | typeof PdfFileIcon

export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/)
  return match?.[1]?.toLowerCase() ?? ''
}

/** Display name without extension (documents only). */
export function getDocumentDisplayName(fileName: string): string {
  const ext = getFileExtension(fileName)
  if (!ext) return fileName
  return fileName.slice(0, -(ext.length + 1)) || fileName
}

export function getDocumentFileIcon(fileName: string): TreeFileIcon {
  switch (getFileExtension(fileName)) {
    case 'pdf':
      return PdfFileIcon
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'svg':
    case 'tif':
    case 'tiff':
      return FileImage
    case 'xls':
    case 'xlsx':
    case 'csv':
      return FileSpreadsheet
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return FileArchive
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'm4a':
      return FileAudio
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
    case 'webm':
      return FileVideo
    case 'js':
    case 'ts':
    case 'tsx':
    case 'json':
    case 'xml':
    case 'html':
    case 'css':
      return FileCode
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return FileText
    default:
      return File
  }
}

export function getDocumentFileIconClassName(fileName: string): string {
  switch (getFileExtension(fileName)) {
    case 'pdf':
      return 'text-red-600 dark:text-red-400'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'svg':
    case 'tif':
    case 'tiff':
      return 'text-sky-600 dark:text-sky-400'
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'doc':
    case 'docx':
      return 'text-blue-600 dark:text-blue-400'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-muted-foreground'
  }
}
