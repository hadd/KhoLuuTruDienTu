import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  canReviewArchive,
  canSubmitArchive,
} from '@/features/archive-submission/lib/archiveSubmissionAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useArchiveSubmissionAccess() {
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
      canSubmitArchive: canSubmitArchive(permissions),
      canReviewArchive: canReviewArchive(permissions),
    }
  }, [user, rolePermissions])
}
