import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { OrganizeMultiSelection } from '@/features/scan-intake/lib/organizeMultiSelection'
import {
  isFolderChecked,
} from '@/features/scan-intake/lib/organizeMultiSelection'
import type { OrganizeTreeNode } from '@/features/scan-intake/lib/organizeFolderTree'
import { formatFolderSegment } from '@/features/scan-intake/lib/sanitizeFolderPath'
import { cn } from '@/lib/utils/cn'

interface OrganizeFolderTreeProps {
  nodes: Array<OrganizeTreeNode>
  selection: OrganizeMultiSelection
  onToggleFolder: (path: string) => void
  onTogglePdf: (key: string) => void
  dragPdfKey: string | null
  onDragPdfStart: (key: string) => void
  onDragPdfEnd: () => void
  onDropPdf: (folderPath: string) => void
  onAddSubfolder: (parentPath: string) => void
  onRenameFolder: (folderPath: string, currentLabel: string) => void
  onRenamePdf: (pdfKey: string, currentLabel: string) => void
  onMoveToInbox: (pdfKey: string) => void
  disabled?: boolean
}

function collectPaths(nodes: Array<OrganizeTreeNode>): Array<string> {
  const paths: Array<string> = []
  function walk(node: OrganizeTreeNode) {
    paths.push(node.path)
    for (const child of node.children) walk(child)
  }
  for (const node of nodes) walk(node)
  return paths
}

function FolderTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selection,
  onToggleFolder,
  onTogglePdf,
  dragPdfKey,
  onDragPdfStart,
  onDragPdfEnd,
  onDropPdf,
  onAddSubfolder,
  onRenameFolder,
  onRenamePdf,
  onMoveToInbox,
  disabled,
}: {
  node: OrganizeTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  selection: OrganizeMultiSelection
  onToggleFolder: (path: string) => void
  onTogglePdf: (key: string) => void
  dragPdfKey: string | null
  onDragPdfStart: (key: string) => void
  onDragPdfEnd: () => void
  onDropPdf: (folderPath: string) => void
  onAddSubfolder: (parentPath: string) => void
  onRenameFolder: (folderPath: string, currentLabel: string) => void
  onRenamePdf: (pdfKey: string, currentLabel: string) => void
  onMoveToInbox: (pdfKey: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('scan-intake')
  const isOpen = expanded.has(node.path)
  const hasChildren = node.children.length > 0
  const showChevron = hasChildren || node.pdfs.length > 0
  const isFolderSelected = isFolderChecked(selection, node.path)
  const folderCheckboxDisabled = disabled || selection?.type === 'pdf'

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md border border-transparent px-1 py-1',
          'hover:border-dashed hover:border-muted-foreground/40',
          dragPdfKey && !disabled && 'border-dashed border-muted-foreground/30',
          isFolderSelected && 'border-primary bg-primary/5',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onDragOver={(e) => {
          if (!dragPdfKey || disabled) return
          e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (!dragPdfKey || disabled) return
          onDropPdf(node.path)
        }}
      >
        <Checkbox
          checked={isFolderSelected}
          disabled={folderCheckboxDisabled}
          onCheckedChange={() => onToggleFolder(node.path)}
          onClick={(e) => e.stopPropagation()}
          aria-label={formatFolderSegment(node.label)}
        />

        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.path)
          }}
          aria-label={isOpen ? t('organize.collapseFolder') : t('organize.expandFolder')}
        >
          {showChevron ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Folder className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="truncate text-sm font-medium">
            {formatFolderSegment(node.label)}
          </span>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          disabled={disabled}
          onClick={() => onRenameFolder(node.path, formatFolderSegment(node.label))}
          title={t('organize.renameFolderTitle')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          disabled={disabled}
          onClick={() => onAddSubfolder(node.path)}
          title={t('organize.createSubfolderTitle')}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isOpen ? (
        <div>
          {node.pdfs.map((pdf) => {
            const pdfLabel = pdf.name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
            return (
              <div
                key={pdf.key}
                draggable={!disabled}
                onDragStart={() => onDragPdfStart(pdf.key)}
                onDragEnd={onDragPdfEnd}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground',
                  'hover:bg-muted/60',
                  dragPdfKey === pdf.key && 'opacity-50',
                )}
                style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{pdfLabel}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                  disabled={disabled}
                  onClick={() => onMoveToInbox(pdf.key)}
                  title={t('organize.moveToInbox')}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                  disabled={disabled}
                  onClick={() => onRenamePdf(pdf.key, pdfLabel)}
                  title={t('organize.renamePdfTitle')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}

          {node.pdfs.length === 0 && node.children.length === 0 ? (
            <p
              className="py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
            >
              {t('organize.dropHere')}
            </p>
          ) : null}

          {node.children.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selection={selection}
              onToggleFolder={onToggleFolder}
              onTogglePdf={onTogglePdf}
              dragPdfKey={dragPdfKey}
              onDragPdfStart={onDragPdfStart}
              onDragPdfEnd={onDragPdfEnd}
              onDropPdf={onDropPdf}
              onAddSubfolder={onAddSubfolder}
              onRenameFolder={onRenameFolder}
              onRenamePdf={onRenamePdf}
              onMoveToInbox={onMoveToInbox}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function OrganizeFolderTree({
  nodes,
  selection,
  onToggleFolder,
  onTogglePdf,
  dragPdfKey,
  onDragPdfStart,
  onDragPdfEnd,
  onDropPdf,
  onAddSubfolder,
  onRenameFolder,
  onRenamePdf,
  onMoveToInbox,
  disabled,
}: OrganizeFolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const paths = collectPaths(nodes)
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const path of paths) next.add(path)
      return next
    })
  }, [nodes])

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <FolderTreeNode
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selection={selection}
          onToggleFolder={onToggleFolder}
          onTogglePdf={onTogglePdf}
          dragPdfKey={dragPdfKey}
          onDragPdfStart={onDragPdfStart}
          onDragPdfEnd={onDragPdfEnd}
          onDropPdf={onDropPdf}
          onAddSubfolder={onAddSubfolder}
          onRenameFolder={onRenameFolder}
          onRenamePdf={onRenamePdf}
          onMoveToInbox={onMoveToInbox}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
