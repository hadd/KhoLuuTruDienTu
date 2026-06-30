import type { ScanIntakeFolder, ScanIntakeFolderPdf } from '@/features/scan-intake/types'
import { sanitizeFolderPath } from '@/features/scan-intake/lib/sanitizeFolderPath'

export interface OrganizeTreeNode {
  path: string
  label: string
  children: Array<OrganizeTreeNode>
  pdfs: Array<ScanIntakeFolderPdf>
}

function addPathWithAncestors(paths: Set<string>, rawPath: string) {
  const path = sanitizeFolderPath(rawPath)
  if (!path) return

  const parts = path.split('/')
  for (let i = 1; i <= parts.length; i++) {
    paths.add(parts.slice(0, i).join('/'))
  }
}

function collectFolderPaths(
  folders: Array<ScanIntakeFolder>,
  extraPaths: Array<string>,
): Set<string> {
  const paths = new Set<string>()
  for (const folder of folders) {
    addPathWithAncestors(paths, folder.folderPath)
  }
  for (const path of extraPaths) {
    addPathWithAncestors(paths, path)
  }
  return paths
}

function buildNode(
  path: string,
  paths: Set<string>,
  pdfByFolder: Map<string, Array<ScanIntakeFolderPdf>>,
): OrganizeTreeNode {
  const label = path.split('/').pop() ?? path
  const childPaths = [...paths]
    .filter((candidate) => {
      if (candidate === path) return false
      const prefix = `${path}/`
      if (!candidate.startsWith(prefix)) return false
      const rest = candidate.slice(prefix.length)
      return rest.length > 0 && !rest.includes('/')
    })
    .sort()

  return {
    path,
    label,
    pdfs: pdfByFolder.get(path) ?? [],
    children: childPaths.map((childPath) => buildNode(childPath, paths, pdfByFolder)),
  }
}

export function buildOrganizeTree(
  folders: Array<ScanIntakeFolder>,
  extraPaths: Array<string>,
): Array<OrganizeTreeNode> {
  const paths = collectFolderPaths(folders, extraPaths)
  const pdfByFolder = new Map(
    folders.map((folder) => [sanitizeFolderPath(folder.folderPath), folder.pdfs]),
  )

  const rootPaths = [...paths]
    .filter((path) => !path.includes('/'))
    .sort()

  return rootPaths.map((path) => buildNode(path, paths, pdfByFolder))
}

export function hasOrganizeTree(nodes: Array<OrganizeTreeNode>): boolean {
  return nodes.length > 0
}
