import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  hasArchiveBorrowReadingPermission,
  hasArchiveBorrowRequestPermission,
  hasArchiveBorrowReviewPermission,
} from '@/features/archive-borrow/lib/archiveBorrowAccess'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'

export function useArchiveBorrowAccess() {
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

    const canRequestBorrow = hasArchiveBorrowRequestPermission(permissions)
    const canReviewBorrow = hasArchiveBorrowReviewPermission(permissions)
    const canReadBorrow = hasArchiveBorrowReadingPermission(permissions)

    return {
      permissions,
      canRequestBorrow,
      canReviewBorrow,
      canReadBorrow,
      canAccessBorrow: canRequestBorrow || canReviewBorrow || canReadBorrow,
    }
  }, [user, rolePermissions])
}
