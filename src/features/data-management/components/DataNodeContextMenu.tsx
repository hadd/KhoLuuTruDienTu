import {
  Edit3,
  Eye,
  FilePlus2,
  FolderPlus,
  PenLine,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { DataNodeActionDialogMode } from '@/features/data-management/components/DataNodeActionDialogs'
import type {
  DataManagementRole,
  RolePermissions,
} from '@/features/data-management/config/roleConfig'
import {
  canShowAssignAction,
  canShowAssignEditorAction,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export function DataNodeContextMenu({
  node,
  parentNode,
  open,
  position,
  onAction,
  onViewInfo,
  onClose,
  role,
  permissions,
}: {
  node: DataTreeNodeT | null
  parentNode?: DataTreeNodeT | null
  open: boolean
  position: { x: number; y: number } | null
  onAction: (node: DataTreeNodeT, mode: DataNodeActionDialogMode) => void
  onViewInfo: (node: DataTreeNodeT) => void
  onClose: () => void
  role: DataManagementRole
  permissions: RolePermissions
}) {
  const { t } = useTranslation('data-management')
  const menuRef = useRef<HTMLDivElement>(null)

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

  if (!open || !node || !position) return null

  const isRoot = node.parentId === null
  const assignOptions = { role, parentNode }

  const baseItems: Array<{
    key: DataNodeActionDialogMode | 'viewInfo'
    label: string
    icon: React.ComponentType<{ className?: string }>
    variant?: 'destructive'
    hidden?: boolean
  }> = [
    { key: 'viewInfo', label: t('contextMenu.viewInfo'), icon: Eye },
    { key: 'rename', label: t('contextMenu.edit'), icon: Edit3 },
    {
      key: 'addDocument',
      label: t('contextMenu.addDocument'),
      icon: FilePlus2,
    },
    { key: 'addFolder', label: t('contextMenu.addFolder'), icon: FolderPlus },
    {
      key: 'assignEditor',
      label: t('contextMenu.assignEditor'),
      icon: PenLine,
    },
    { key: 'assign', label: t('contextMenu.assign'), icon: UserPlus },
    {
      key: 'delete',
      label: t('contextMenu.delete'),
      icon: Trash2,
      variant: 'destructive',
    },
  ]

  const visibleItems = baseItems.filter((item) => {
    if (item.key === 'viewInfo') return true

    if (item.key === 'assignEditor' && !permissions.canAssignEditor)
      return false
    if (item.key === 'assign' && !permissions.canAssign) return false
    if (item.key === 'delete' && !permissions.canDelete) return false
    if (item.key === 'rename' && !permissions.canRename) return false
    if (item.key === 'addDocument' && !permissions.canAddDocument) return false
    if (item.key === 'addFolder' && !permissions.canUpload) return false

    if (isRoot) {
      if (item.key === 'assign' || item.key === 'assignEditor') return false
      return (
        item.key === 'rename' ||
        item.key === 'addFolder' ||
        item.key === 'delete'
      )
    }

    if (node.type === 'document') {
      return item.key === 'delete'
    }

    if (node.type === 'record') {
      if (item.key === 'assignEditor') return canShowAssignEditorAction(node)
      if (item.key === 'assign') return canShowAssignAction(node, assignOptions)
      if (item.key === 'addFolder') return false
      return (
        item.key === 'rename' ||
        item.key === 'addDocument' ||
        item.key === 'delete'
      )
    }

    if (node.type === 'folder') {
      if (item.key === 'addDocument') return false
      if (item.key === 'assignEditor') return canShowAssignEditorAction(node)
      if (item.key === 'assign') return canShowAssignAction(node, assignOptions)
      return (
        item.key === 'rename' ||
        item.key === 'addFolder' ||
        item.key === 'delete'
      )
    }

    return false
  })

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 w-52 rounded-md border border-border bg-popover p-1 shadow-md',
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex flex-col gap-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'w-full justify-start gap-2 px-2 py-1.5 text-sm',
                item.variant === 'destructive' &&
                  'text-destructive hover:text-destructive',
              )}
              onClick={() => {
                if (item.key === 'viewInfo') {
                  onViewInfo(node)
                } else {
                  onAction(node, item.key)
                }
                onClose()
              }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
