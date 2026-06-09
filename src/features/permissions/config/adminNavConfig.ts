import type { LucideIcon } from 'lucide-react'
import { Shield } from 'lucide-react'

export type AdminPermissionNavItem = {
  to: '/admin/permissions/function-matrix'
  labelKey: 'admin.permissions'
  icon: LucideIcon
}

export const adminPermissionNavItem: AdminPermissionNavItem = {
  to: '/admin/permissions/function-matrix',
  labelKey: 'admin.permissions',
  icon: Shield,
}
