import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

function getPathToNode(
  tree: DataTreeNodeT,
  targetId: string,
  path: Array<DataTreeNodeT> = [],
): Array<DataTreeNodeT> {
  const currentPath = [...path, tree]
  if (tree.id === targetId) return currentPath

  for (const child of tree.children) {
    const result = getPathToNode(child, targetId, currentPath)
    if (result.length > 0) return result
  }

  return []
}

export function ReadOnlyDossierTree({
  tree,
  selectedId,
  onSelect,
}: {
  tree: DataTreeNodeT
  selectedId: string | undefined
  onSelect: (node: DataTreeNodeT) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([tree.id]))

  useEffect(() => {
    if (!selectedId) return
    const path = getPathToNode(tree, selectedId)
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const node of path) {
        next.add(node.id)
      }
      return next
    })
  }, [selectedId, tree])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1">
      <ul className="space-y-0.5" role="tree">
        <TreeBranch
          node={tree}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </ul>
    </div>
  )
}

function TreeBranch({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: DataTreeNodeT
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId: string | undefined
  onSelect: (node: DataTreeNodeT) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isRecord = node.type === 'record'
  const isSelected = isRecord && selectedId === node.id

  const handleClick = () => {
    if (hasChildren) onToggle(node.id)
    if (isRecord) onSelect(node)
  }

  const Icon =
    node.type === 'document'
      ? FileText
      : isExpanded
        ? FolderOpen
        : Folder

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        data-tree-node-id={node.id}
        className={cn(
          'flex w-full items-center gap-1 rounded-md text-left text-sm transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-muted/60',
          isRecord ? 'cursor-pointer' : hasChildren ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={cn('size-4 transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate py-1.5 pr-2">{node.name}</span>
      </div>

      {hasChildren && isExpanded ? (
        <ul role="group">
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
