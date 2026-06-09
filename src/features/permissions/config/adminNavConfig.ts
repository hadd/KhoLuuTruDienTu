import type { LucideIcon } from 'lucide-react'
import { PenLine, Shield, TableProperties } from 'lucide-react'

export type AdminPermissionNavItem = {
  to: '/admin/permissions/function-matrix' | '/admin/permissions/editing'
  labelKey:
    | 'admin.permissionsFunctionMatrix'
    | 'admin.permissionsEditing'
  icon: LucideIcon
}

export type AdminPermissionNavGroup = {
  id: 'permissions'
  labelKey: 'admin.permissions'
  icon: LucideIcon
  basePath: '/admin/permissions'
  items: AdminPermissionNavItem[]
}

export const adminPermissionNavGroup: AdminPermissionNavGroup = {
  id: 'permissions',
  labelKey: 'admin.permissions',
  icon: Shield,
  basePath: '/admin/permissions',
  items: [
    {
      to: '/admin/permissions/function-matrix',
      labelKey: 'admin.permissionsFunctionMatrix',
      icon: TableProperties,
    },
    {
      to: '/admin/permissions/editing',
      labelKey: 'admin.permissionsEditing',
      icon: PenLine,
    },
  ],
}
