import { Edit3, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getChildNodeType } from '@/features/document-scan/lib/scanTreeUtils'
import type { ScanTreeBranchT } from '@/features/document-scan/types'
import { cn } from '@/lib/utils/cn'

export type ScanContextAction = 'add-child' | 'edit' | 'delete'

interface ScanContextMenuProps {
  node: ScanTreeBranchT | null
  open: boolean
  position: { x: number; y: number } | null
  onAction: (node: ScanTreeBranchT, action: ScanContextAction) => void
  onClose: () => void
}

export function ScanContextMenu({
  node,
  open,
  position,
  onAction,
  onClose,
}: ScanContextMenuProps) {
  const { t } = useTranslation('document-scan')
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState<{
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  useLayoutEffect(() => {
    if (!open || !position || !menuRef.current) {
      setAdjustedPosition(null)
      return
    }

    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    const x = Math.min(position.x, window.innerWidth - rect.width - padding)
    const y = Math.min(position.y, window.innerHeight - rect.height - padding)
    setAdjustedPosition({ x: Math.max(padding, x), y: Math.max(padding, y) })
  }, [open, position])

  if (!open || !node || !position) return null

  const childType = getChildNodeType(node.type)
  const canAddChild = childType !== null

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md',
      )}
      style={{
        left: adjustedPosition?.x ?? position.x,
        top: adjustedPosition?.y ?? position.y,
      }}
    >
      {canAddChild ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            onAction(node, 'add-child')
            onClose()
          }}
        >
          <Plus className="size-4" />
          {t('actions.addChild')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => {
          onAction(node, 'edit')
          onClose()
        }}
      >
        <Edit3 className="size-4" />
        {t('actions.edit')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-destructive hover:text-destructive"
        onClick={() => {
          onAction(node, 'delete')
          onClose()
        }}
      >
        <Trash2 className="size-4" />
        {t('actions.delete')}
      </Button>
    </div>
  )
}
