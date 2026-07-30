import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'



import {

  hasArchiveDisposalCreatePermission,

  hasArchiveDisposalManagePermission,

  hasArchiveDisposalReadPermission,

  hasArchiveDisposalSubmitPermission,

  hasArchiveDisposalUpdatePermission,

} from '@/features/archive-disposal/lib/archiveDisposalAccess'

import {

  getCurrentUserRoleId,

  resolvePermissionsForUser,

} from '@/features/auth/lib/permission-access'

import { profileQueryOptions } from '@/features/auth/queries'

import { rolePermissionsQueryOptions } from '@/features/permissions/queries'



export function useArchiveDisposalAccess() {

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



    return {

      permissions,

      canReadDisposal: hasArchiveDisposalReadPermission(permissions),

      canCreateDisposal: hasArchiveDisposalCreatePermission(permissions),

      canUpdateDisposal: hasArchiveDisposalUpdatePermission(permissions),

      canSubmitDisposal: hasArchiveDisposalSubmitPermission(permissions),

      /** Any write capability — backward-compatible alias. */

      canManageDisposal: hasArchiveDisposalManagePermission(permissions),

    }

  }, [user, rolePermissions])

}

