import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  Library,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { canCheckNode } from '@/features/document-scan/lib/scanTreeUtils'
import type { ScanTreeBranchT } from '@/features/document-scan/types'
import { cn } from '@/lib/utils/cn'

interface ScanTreeNodeProps {
  node: ScanTreeBranchT
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId?: string
  checkedIds: Set<string>
  onSelect: (id: string) => void
  onToggleCheck: (id: string, checked: boolean) => void
  onContextMenu?: (node: ScanTreeBranchT, x: number, y: number) => void
}

const NODE_ICONS = {
  project: Library,
  fond: Layers,
  dossier: Folder,
  document: FileText,
} as const

export function ScanTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  checkedIds,
  onSelect,
  onToggleCheck,
  onContextMenu,
}: ScanTreeNodeProps) {
  const { t } = useTranslation('document-scan')
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const isCheckable = canCheckNode(node)
  const Icon = node.type === 'dossier' && isExpanded ? FolderOpen : NODE_ICONS[node.type]

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        data-tree-node-id={node.id}
        className={cn(
          'group flex items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors',
          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenu?.(node, event.clientX, event.clientY)
        }}
      >
        {isCheckable ? (
          <Checkbox
            checked={checkedIds.has(node.id)}
            onCheckedChange={(checked) =>
              onToggleCheck(node.id, checked === true)
            }
            onClick={(event) => event.stopPropagation()}
            aria-label={t(`nodeTypes.${node.type}`)}
          />
        ) : (
          <span className="size-4 shrink-0" />
        )}

        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')}
            />
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(node.id)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <ul className="space-y-0.5" role="group">
          {node.children.map((child) => (
            <ScanTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              checkedIds={checkedIds}
              onSelect={onSelect}
              onToggleCheck={onToggleCheck}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
