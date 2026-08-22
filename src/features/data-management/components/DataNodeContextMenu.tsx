import {
  Edit3,
  Eye,
  FileDown,
  FolderKanban,
  Package,
  PenLine,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { DataNodeActionDialogMode } from '@/features/data-management/components/DataNodeActionDialogs'
import type {
  DataManagementRole,
  RolePermissions,
} from '@/features/data-management/config/roleConfig'
import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import { canExportNode } from '@/features/data-management/lib/exportHelpers'
import {
  canShowAssignAction,
  canShowAssignEditorAction,
  canShowAssignProjectAction,
  canShowRenameAction,
  canShowRevokeAssignmentsAction,
  canShowSubmitArchiveAction,
  isDossierWorkflowNode,
} from '@/features/data-management/lib/treeUtils'
import { useRoleAccess } from '@/features/permissions/hooks/useRoleAccess'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { cn } from '@/lib/utils/cn'

export function DataNodeContextMenu({
  node,
  open,
  position,
  onAction,
  onViewInfo,
  onExportExcel,
  onUploadDossier,
  onUploadDocument,
  onSubmitArchive,
  onClose,
  role,
  permissions,
  canSubmitArchive = false,
}: {
  node: DataTreeNodeT | null
  open: boolean
  position: { x: number; y: number } | null
  onAction: (node: DataTreeNodeT, mode: DataNodeActionDialogMode) => void
  onViewInfo: (node: DataTreeNodeT) => void
  onExportExcel?: (node: DataTreeNodeT) => void
  onUploadDossier?: (node: DataTreeNodeT) => void
  onUploadDocument?: (node: DataTreeNodeT) => void
  onSubmitArchive?: (node: DataTreeNodeT) => void
  onClose: () => void
  role: DataManagementRole
  permissions: RolePermissions
  canSubmitArchive?: boolean
}) {
  const { t } = useTranslation('data-management')
  const { permissions: userPermissions } = useRoleAccess()
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

    const menuRect = menuRef.current.getBoundingClientRect()
    const margin = 8
    let x = position.x
    let y = position.y

    if (y + menuRect.height + margin > window.innerHeight) {
      y = Math.max(margin, position.y - menuRect.height)
    }

    if (x + menuRect.width + margin > window.innerWidth) {
      x = Math.max(margin, window.innerWidth - menuRect.width - margin)
    }

    setAdjustedPosition({ x, y })
  }, [open, position])

  if (!open || !node || !position) return null

  const isRoot = node.parentId === null
  const assignOptions = { role }
  const assignProjectLabelKey = node.projectCode?.trim()
    ? 'changeProject'
    : 'assignProject'

  const baseItems: Array<{
    key:
    | DataNodeActionDialogMode
    | 'viewInfo'
    | 'exportExcel'
    | 'uploadDossier'
    | 'uploadDocument'
    | 'submitArchive'
    label: string
    icon: React.ComponentType<{ className?: string }>
    variant?: 'destructive'
    hidden?: boolean
  }> = [
      { key: 'viewInfo', label: t('contextMenu.viewInfo'), icon: Eye },
      {
        key: 'exportExcel',
        label: t('contextMenu.exportExcel'),
        icon: FileDown,
      },
      { key: 'rename', label: t('contextMenu.edit'), icon: Edit3 },
      {
        key: 'assignProject',
        label: t(`contextMenu.${assignProjectLabelKey}` as const),
        icon: FolderKanban,
      },
      {
        key: 'submitArchive',
        label: t('contextMenu.submitArchive'),
        icon: Package,
      },
      {
        key: 'uploadDocument',
        label: t('contextMenu.uploadDocument'),
        icon: Upload,
      },
      {
        key: 'uploadDossier',
        label: t('contextMenu.uploadDossier'),
        icon: Upload,
      },
      {
        key: 'assignEditor',
        label: t('contextMenu.assignEditor'),
        icon: PenLine,
      },
      { key: 'assign', label: t('contextMenu.assign'), icon: UserPlus },
      {
        key: 'revokeAssignments',
        label: t('contextMenu.revokeAssignments'),
        icon: Undo2,
      },
      {
        key: 'delete',
        label: t('contextMenu.delete'),
        icon: Trash2,
        variant: 'destructive',
      },
    ]

  const canExportDossiers = isPermissionGranted(
    userPermissions,
    'dossiers.export',
    'dossiers',
  )

  const visibleItems = baseItems.filter((item) => {
    if (item.key === 'viewInfo') return true

    if (item.key === 'exportExcel') {
      return canExportDossiers && canExportNode(node)
    }

    if (item.key === 'uploadDossier') {
      return (
        permissions.canUpload &&
        node.type === 'folder' &&
        node.id !== DATA_TREE_ROOT_ID &&
        !isDossierWorkflowNode(node)
      )
    }

    if (item.key === 'uploadDocument') {
      return (
        permissions.canUpload &&
        (node.type === 'record' || isDossierWorkflowNode(node))
      )
    }

    if (item.key === 'assignEditor' && !permissions.canAssignEditor)
      return false
    if (item.key === 'assign' && !permissions.canAssign) return false
    if (item.key === 'revokeAssignments') {
      return (
        permissions.canRevokeAssignments && canShowRevokeAssignmentsAction(node)
      )
    }
    if (item.key === 'delete' && !permissions.canDelete) return false
    if (item.key === 'rename') {
      if (!permissions.canRename) return false
      return canShowRenameAction(node)
    }
    if (item.key === 'assignProject') {
      if (!permissions.canAssignProject) return false
      return canShowAssignProjectAction(node)
    }
    if (item.key === 'submitArchive') {
      if (!canSubmitArchive) return false
      return canShowSubmitArchiveAction(node)
    }

    if (isRoot) {
      if (
        item.key === 'assign' ||
        item.key === 'assignEditor' ||
        item.key === 'revokeAssignments'
      )
        return false
      return item.key === 'delete'
    }

    if (node.type === 'document') {
      return item.key === 'delete'
    }

    if (node.type === 'record') {
      if (item.key === 'assignEditor') return canShowAssignEditorAction(node)
      if (item.key === 'assign') return canShowAssignAction(node, assignOptions)
      return item.key === 'delete'
    }

    if (node.type === 'folder') {
      if (item.key === 'assignEditor') return canShowAssignEditorAction(node)
      if (item.key === 'assign') return canShowAssignAction(node, assignOptions)
      if (item.key === 'revokeAssignments') {
        return (
          permissions.canRevokeAssignments &&
          canShowRevokeAssignmentsAction(node)
        )
      }
      return item.key === 'delete'
    }

    return false
  })

  const menuPosition = adjustedPosition ?? position

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 w-52 rounded-md border border-border bg-popover p-1 shadow-md',
      )}
      style={{ left: menuPosition.x, top: menuPosition.y }}
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
                } else if (item.key === 'exportExcel') {
                  onExportExcel?.(node)
                } else if (item.key === 'uploadDossier') {
                  onUploadDossier?.(node)
                } else if (item.key === 'uploadDocument') {
                  onUploadDocument?.(node)
                } else if (item.key === 'submitArchive') {
                  onSubmitArchive?.(node)
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
