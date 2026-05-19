import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getPathToNode } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function DataFolderTree({
  tree,
  selectedId,
  onSelect,
}: {
  tree: DataTreeNodeT
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([tree.id]))

  useEffect(() => {
    if (!selectedId) return
    const path = getPathToNode(tree, selectedId)
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const n of path) {
        next.add(n.id)
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
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
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
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('data-management')
  const isFolder = node.type !== 'document'
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const Icon =
    node.type === 'document' ? FileText : isOpen ? FolderOpen : Folder

  return (
    <li role="none">
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 text-sm',
          isSelected && 'bg-accent text-accent-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isFolder ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? t('tree.collapse') : t('tree.expand')}
          >
            <ChevronRight
              className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
            />
          </Button>
        ) : (
          <span className="inline-flex w-7 shrink-0 justify-center" aria-hidden />
        )}
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors',
            !isSelected && 'hover:bg-muted/80',
          )}
          onClick={() => onSelect(node.id)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate">{node.name}</span>
        </button>
      </div>
      {isFolder && isOpen && node.children.length > 0 ? (
        <ul className="space-y-0.5" role="group">
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
