import {
  AlertCircle,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  UserCheck,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import {
  getPathToNode,
  hasAssignedIndicator,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function DataFolderTree({
  tree,
  selectedId,
  selectedIds,
  multiSelect = false,
  multiSelectTarget = 'folder',
  onSelect,
  onContextMenuNode,
  collapsed = false,
  onExpandNode,
  className,
  scrollable = true,
  pendingErrorReportDossierIds,
}: {
  tree: DataTreeNodeT
  selectedId?: string | undefined
  selectedIds?: Array<string>
  multiSelect?: boolean
  multiSelectTarget?: 'folder' | 'record'
  onSelect: (id: string) => void
  onContextMenuNode?: (node: DataTreeNodeT, x: number, y: number) => void
  collapsed?: boolean
  onExpandNode?: (id: string) => void
  className?: string
  scrollable?: boolean
  pendingErrorReportDossierIds?: Set<string>
}) {
  if (collapsed) return null

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([tree.id]),
  )

  const prevSelectedIdRef = useRef<string | undefined>(undefined)
  const hasExpandedForSelectionRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (multiSelect || !selectedId) return

    const selectedChanged = prevSelectedIdRef.current !== selectedId
    if (selectedChanged) {
      prevSelectedIdRef.current = selectedId
      hasExpandedForSelectionRef.current = undefined
    }

    if (hasExpandedForSelectionRef.current === selectedId) return

    const path = getPathToNode(tree, selectedId)
    if (path.length === 0) return

    hasExpandedForSelectionRef.current = selectedId

    setExpanded((prev) => {
      const next = new Set(prev)
      for (const n of path) {
        next.add(n.id)
      }
      return next
    })
  }, [multiSelect, selectedId, tree])

  useEffect(() => {
    if (multiSelect || !selectedId) return
    const selectedElement = document.querySelector(
      `[data-tree-node-id="${selectedId}"]`,
    )
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [multiSelect, selectedId])

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else {
          next.add(id)
          if (onExpandNode) onExpandNode(id)
        }
        return next
      })
    },
    [onExpandNode],
  )

  const treeContent = (
    <ul className="space-y-0.5" role="tree">
      {tree.children.map((child) => (
        <TreeBranch
          key={child.id}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          selectedIds={selectedIds}
          multiSelect={multiSelect}
          multiSelectTarget={multiSelectTarget}
          onSelect={onSelect}
          onContextMenuNode={onContextMenuNode}
          collapsed={collapsed}
          pendingErrorReportDossierIds={pendingErrorReportDossierIds}
        />
      ))}
    </ul>
  )

  if (!scrollable) {
    return treeContent
  }

  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1',
        className,
      )}
      onWheel={(event) => event.stopPropagation()}
    >
      {treeContent}
    </div>
  )
}

function TreeBranch({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  selectedIds,
  multiSelect,
  multiSelectTarget,
  onSelect,
  onContextMenuNode,
  collapsed,
  pendingErrorReportDossierIds,
}: {
  node: DataTreeNodeT
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedId?: string | undefined
  selectedIds?: Array<string>
  multiSelect: boolean
  multiSelectTarget: 'folder' | 'record'
  onSelect: (id: string) => void
  onContextMenuNode?: (node: DataTreeNodeT, x: number, y: number) => void
  collapsed: boolean
  pendingErrorReportDossierIds?: Set<string>
}) {
  const { t } = useTranslation('data-management')
  const isFolder = node.type !== 'document'
  const isRecord = node.type === 'record'
  const showMultiSelectCheckbox =
    multiSelect &&
    !collapsed &&
    ((multiSelectTarget === 'folder' && isFolder) ||
      (multiSelectTarget === 'record' && isRecord))
  const isOpen = expanded.has(node.id)
  const isSelected = multiSelect
    ? (selectedIds?.includes(node.id) ?? false)
    : selectedId === node.id
  const showAssigned = hasAssignedIndicator(node)
  const showPendingErrorReport = Boolean(
    node.dossierId &&
      pendingErrorReportDossierIds?.has(node.dossierId),
  )
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
          collapsed ? (
            <span className="inline-flex size-7 shrink-0" aria-hidden />
          ) : (
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
          )
        ) : (
          <span
            className="inline-flex w-7 shrink-0 justify-center"
            aria-hidden
          />
        )}
        <button
          type="button"
          data-tree-node-id={node.id}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-0.5 text-left transition-colors',
            !isSelected && 'hover:bg-muted/80',
            collapsed && 'justify-center',
          )}
          onClick={() => onSelect(node.id)}
        >
          {showMultiSelectCheckbox ? (
            <Checkbox
              checked={isSelected}
              className="pointer-events-none shrink-0"
              aria-hidden
              tabIndex={-1}
            />
          ) : null}
          {collapsed ? (
            <span className="inline-flex size-4 shrink-0" aria-hidden />
          ) : (
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          {collapsed ? null : (
            <>
              <span className="min-w-0 truncate">{node.name}</span>
              {node.dossierStatus ? (
                <DossierStatusBadge
                  status={node.dossierStatus}
                  className="inline-flex shrink-0"
                />
              ) : null}
              {showAssigned ? (
                <span
                  className="inline-flex shrink-0"
                  title={t('tree.assigned')}
                >
                  <UserCheck
                    className="size-3.5 text-emerald-600"
                    aria-label={t('tree.assigned')}
                  />
                </span>
              ) : null}
              {showPendingErrorReport ? (
                <span
                  className="inline-flex shrink-0"
                  title={t('editorErrorReport.tree.pendingIndicator')}
                >
                  <AlertCircle
                    className="size-3.5 text-destructive"
                    aria-label={t('editorErrorReport.tree.pendingIndicator')}
                  />
                </span>
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
              selectedIds={selectedIds}
              multiSelect={multiSelect}
              multiSelectTarget={multiSelectTarget}
              onSelect={onSelect}
              onContextMenuNode={onContextMenuNode}
              collapsed={collapsed}
              pendingErrorReportDossierIds={pendingErrorReportDossierIds}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
