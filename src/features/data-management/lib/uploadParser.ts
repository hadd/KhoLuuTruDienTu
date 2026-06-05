import type { DataTreeNodeT } from '@/features/data-management/types'
import { createClientId } from '@/lib/utils/id'

export interface ParsedPathNode {
  name: string
  children: Map<string, ParsedPathNode>
  file: File | null
}

function newId(): string {
  return createClientId('dm')
}

/**
 * If the browser reports a single top-level folder, unwrap to it; otherwise wrap all entries.
 */
export function getUploadTreeRoot(parsed: ParsedPathNode): ParsedPathNode {
  if (parsed.children.size === 1) {
    return parsed.children.values().next().value!
  }
  return {
    name: 'upload',
    children: new Map(parsed.children),
    file: null,
  }
}

export function buildParsedTreeFromFiles(files: Array<File>): ParsedPathNode {
  const root: ParsedPathNode = {
    name: '',
    children: new Map(),
    file: null,
  }

  for (const file of files) {
    const rel = file.webkitRelativePath || file.name
    const segments = rel.split('/').filter(Boolean)
    if (segments.length === 0) continue

    let cursor = root
    for (const [i, seg] of segments.entries()) {
      const isLeaf = i === segments.length - 1

      if (!cursor.children.has(seg)) {
        cursor.children.set(seg, {
          name: seg,
          children: new Map(),
          file: null,
        })
      }
      const next = cursor.children.get(seg)!
      if (isLeaf) {
        next.file = file
      }
      cursor = next
    }
  }

  return root
}

/** True if any selected file is not a `.pdf` (directory upload only yields files). */
export function hasInvalidUploadFiles(files: Array<File>): boolean {
  return files.some((f) => !f.name.toLowerCase().endsWith('.pdf'))
}

export interface OversizedUploadFile {
  relativePath: string
  sizeBytes: number
}

/** PDF files whose size exceeds the configured upload limit. */
export function findOversizedUploadFiles(
  files: Array<File>,
  maxSizeBytes: number,
): Array<OversizedUploadFile> {
  return files
    .filter((file) => file.size > maxSizeBytes)
    .map((file) => ({
      relativePath: file.webkitRelativePath || file.name,
      sizeBytes: file.size,
    }))
}

/**
 * Converts parsed upload tree into `DataTreeNodeT` (folders start as `folder`, PDFs as `document`).
 */
export function parsedTreeToDataNodes(
  parsed: ParsedPathNode,
  options: { uploadedBy: string; uploadedAt: string },
): DataTreeNodeT {
  function walk(node: ParsedPathNode, parentId: string | null): DataTreeNodeT {
    const id = newId()

    if (node.file && node.children.size === 0) {
      const sizeBytes = node.file.size
      return {
        id,
        name: node.name,
        type: 'document',
        parentId,
        children: [],
        sizeBytes,
        uploadedAt: options.uploadedAt,
        uploadedBy: options.uploadedBy,
        mimeType: 'application/pdf',
        fileUrl: URL.createObjectURL(node.file),
      }
    }

    const childList = Array.from(node.children.values()).map((c) => walk(c, id))

    return {
      id,
      name: node.name || 'upload',
      type: 'folder',
      parentId,
      children: childList,
      sizeBytes: childList.reduce((s, c) => s + c.sizeBytes, 0),
      uploadedAt: options.uploadedAt,
      uploadedBy: options.uploadedBy,
    }
  }

  return walk(parsed, null)
}
