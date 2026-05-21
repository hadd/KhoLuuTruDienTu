import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DataRecordStatusBadge } from '@/features/data-management/components/DataRecordStatusBadge'
import { getPathToNode } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function DataFolderTree({
  tree,
  selectedId,
  onSelect,
  onContextMenuNode,
  collapsed = false,
}: {
  tree: DataTreeNodeT
  selectedId: string | undefined
  onSelect: (id: string) => void
  onContextMenuNode?: (node: DataTreeNodeT, x: number, y: number) => void
  collapsed?: boolean
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([tree.id]),
  )

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
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card',
        collapsed ? 'p-0.5' : 'p-1',
      )}
    >
      <ul className="space-y-0.5" role="tree">
        <TreeBranch
          node={tree}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
          onContextMenuNode={onContextMenuNode}
          collapsed={collapsed}
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
  onContextMenuNode,
  collapsed,
}: {
  node: DataTreeNodeT
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId: string | undefined
  onSelect: (id: string) => void
  onContextMenuNode?: (node: DataTreeNodeT, x: number, y: number) => void
  collapsed: boolean
}) {
  const { t } = useTranslation('data-management')
  const isFolder = node.type !== 'document'
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const Icon =
    node.type === 'document' ? FileText : isOpen ? FolderOpen : Folder

  function handleContextMenu(event: React.MouseEvent) {
    if (!onContextMenuNode) return
    event.preventDefault()
    onContextMenuNode(node, event.clientX, event.clientY)
  }

  return (
    <li role="none">
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 text-sm',
          isSelected && 'bg-accent text-accent-foreground',
        )}
        style={{ paddingLeft: `${collapsed ? 6 : depth * 12 + 4}px` }}
        onContextMenu={onContextMenuNode ? handleContextMenu : undefined}
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
              className={cn(
                'size-4 transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </Button>
        ) : (
          <span
            className="inline-flex w-7 shrink-0 justify-center"
            aria-hidden
          />
        )}
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors',
            !isSelected && 'hover:bg-muted/80',
            collapsed && 'justify-center',
          )}
          onClick={() => onSelect(node.id)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {collapsed ? null : (
            <>
              <span className="min-w-0 truncate">{node.name}</span>
              {node.type === 'record' && node.recordStatus ? (
                <DataRecordStatusBadge
                  status={node.recordStatus}
                  className="hidden shrink-0 sm:inline-flex"
                />
              ) : null}
            </>
          )}
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
              onContextMenuNode={onContextMenuNode}
              collapsed={collapsed}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
