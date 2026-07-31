import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'



const MODULE = 'archive.disposal'



/** @deprecated Legacy umbrella — use create/update/submit. */

const LEGACY_MANAGE = 'archive.disposal.manage'



export const ARCHIVE_DISPOSAL_PERMISSIONS = {

  read: 'archive.disposal.read',

  create: 'archive.disposal.create',

  update: 'archive.disposal.update',

  submit: 'archive.disposal.submit',

  /** @deprecated */

  manage: LEGACY_MANAGE,

} as const



function hasDisposalPermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

  permissionKey: string,

): boolean {

  return (

    isPermissionGranted(permissions, permissionKey, MODULE) ||

    isPermissionGranted(permissions, LEGACY_MANAGE, MODULE)

  )

}



export function hasArchiveDisposalReadPermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

): boolean {

  return (

    hasDisposalPermission(permissions, ARCHIVE_DISPOSAL_PERMISSIONS.read) ||

    isPermissionGranted(permissions, 'archive.warehouse.read', 'archive.warehouse')

  )

}



export function hasArchiveDisposalCreatePermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

): boolean {

  return hasDisposalPermission(permissions, ARCHIVE_DISPOSAL_PERMISSIONS.create)

}



export function hasArchiveDisposalUpdatePermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

): boolean {

  return hasDisposalPermission(permissions, ARCHIVE_DISPOSAL_PERMISSIONS.update)

}



export function hasArchiveDisposalSubmitPermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

): boolean {

  return hasDisposalPermission(permissions, ARCHIVE_DISPOSAL_PERMISSIONS.submit)

}



/** Any write capability (create, update, or submit). */

export function hasArchiveDisposalManagePermission(

  permissions: Parameters<typeof isPermissionGranted>[0],

): boolean {

  return (

    hasArchiveDisposalCreatePermission(permissions) ||

    hasArchiveDisposalUpdatePermission(permissions) ||

    hasArchiveDisposalSubmitPermission(permissions)

  )

}



export { MODULE as ARCHIVE_DISPOSAL_MODULE }

