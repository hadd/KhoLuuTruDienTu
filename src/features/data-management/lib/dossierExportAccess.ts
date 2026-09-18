import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

/** Base export hoặc bypass trạng thái đều được coi là có quyền xuất. */
export function canExportDossiersPermission(
  permissions: Array<string>,
): boolean {
  return (
    isPermissionGranted(permissions, 'dossiers.export', 'dossiers') ||
    isPermissionGranted(permissions, 'dossiers.export_any_status', 'dossiers')
  )
}

/** Bỏ điều kiện APPROVED/ARCHIVED khi xuất/tải. */
export function canExportAnyStatusPermission(
  permissions: Array<string>,
): boolean {
  return isPermissionGranted(
    permissions,
    'dossiers.export_any_status',
    'dossiers',
  )
}
