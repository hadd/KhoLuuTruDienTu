import { Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  buildScanTree,
  getPathToNode,
} from '@/features/document-scan/lib/scanTreeUtils'
import { ScanTreeNode } from '@/features/document-scan/components/ScanTreeNode'
import type { ScanTreeBranchT, ScanWorkspaceT } from '@/features/document-scan/types'
import { cn } from '@/lib/utils/cn'

interface ScanTreeProps {
  workspace: ScanWorkspaceT
  selectedId?: string
  checkedIds: Array<string>
  onSelect: (id: string) => void
  onToggleCheck: (id: string, checked: boolean) => void
  onContextMenu?: (node: ScanTreeBranchT, x: number, y: number) => void
  onAddProject?: () => void
  className?: string
}

export function ScanTree({
  workspace,
  selectedId,
  checkedIds,
  onSelect,
  onToggleCheck,
  onContextMenu,
  onAddProject,
  className,
}: ScanTreeProps) {
  const { t } = useTranslation('document-scan')
  const tree = buildScanTree(workspace)
  const checkedSet = new Set(checkedIds)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(workspace.rootIds))
  const prevSelectedIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!selectedId) return
    if (prevSelectedIdRef.current === selectedId) return
    prevSelectedIdRef.current = selectedId

    const path = getPathToNode(workspace, selectedId)
    if (path.length === 0) return

    setExpanded((prev) => {
      const next = new Set(prev)
      for (const node of path) {
        next.add(node.id)
      }
      return next
    })
  }, [selectedId, workspace])

  useEffect(() => {
    if (!selectedId) return
    const selectedElement = document.querySelector(
      `[data-tree-node-id="${selectedId}"]`,
    )
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleCheck = useCallback(
    (id: string, checked: boolean) => {
      onToggleCheck(id, checked)
    },
    [onToggleCheck],
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium text-foreground">{t('tree.title')}</h2>
        {onAddProject ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAddProject}>
            <Plus className="size-4" />
            <span className="sr-only">{t('tree.addRoot')}</span>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t('tree.empty')}</p>
        ) : (
          <ul className="space-y-0.5" role="tree">
            {tree.map((node) => (
              <ScanTreeNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                selectedId={selectedId}
                checkedIds={checkedSet}
                onSelect={onSelect}
                onToggleCheck={handleToggleCheck}
                onContextMenu={onContextMenu}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
