import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getCurrentUserRoleId,
  getPrimaryAppRoleFromProfile,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import type {
  DataManagementRole,
  RolePermissions,
} from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { resolveDataManagementRole } from '@/features/data-management/lib/resolveDataManagementRole'
import {
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useDataManagementUserPermissions(): string[] {
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })

  return useMemo(() => {
    return resolvePermissionsForUser(
      user,
      rolePermissions?.rules.permissions,
    )
  }, [user, rolePermissions])
}

export function useDataManagementRole(): DataManagementRole {
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })

  return useMemo(() => {
    const permissions = resolvePermissionsForUser(
      user,
      rolePermissions?.rules.permissions,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    return resolveDataManagementRole(permissions, primaryAppRole)
  }, [user, rolePermissions])
}

export function useDataManagementResolvedPermissions(): RolePermissions {
  const role = useDataManagementRole()
  const userPermissions = useDataManagementUserPermissions()

  return useMemo(() => {
    const basePermissions = getPermissionsByRole(role)

    const canWriteDossiers =
      hasFullAccess(userPermissions) ||
      isPermissionGranted(userPermissions, 'dossiers.write', 'dossiers')

    const canReadProjects = isPermissionGranted(
      userPermissions,
      'projects.read',
      'projects',
    )

    const canAssignDossiers = isPermissionGranted(
      userPermissions,
      'dossiers.assign',
      'dossiers',
    )

    const canSignDossiers = isPermissionGranted(
      userPermissions,
      'dossiers.sign',
      'dossiers',
    )

    return {
      ...basePermissions,
      canUpload: basePermissions.canUpload && canWriteDossiers,
      canDelete: basePermissions.canDelete && canWriteDossiers,
      canRename: basePermissions.canRename && canWriteDossiers,
      canAddDocument: basePermissions.canAddDocument && canWriteDossiers,
      canEditRecordMetadataFields:
        basePermissions.canEditRecordMetadataFields && canWriteDossiers,
      canEditFileMetadataFields:
        basePermissions.canEditFileMetadataFields && canWriteDossiers,
      canReadProjects,
      canAssignProject: basePermissions.canAssignProject && canReadProjects,
      canAssign: basePermissions.canAssign && canAssignDossiers,
      canAssignEditor: basePermissions.canAssignEditor && canAssignDossiers,
      canAssignGroup: basePermissions.canAssignGroup && canAssignDossiers,
      canRevokeAssignments:
        basePermissions.canRevokeAssignments && canAssignDossiers,
      canDigitalSign: basePermissions.canDigitalSign && canSignDossiers,
    }
  }, [role, userPermissions])
}
