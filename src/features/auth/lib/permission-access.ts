import type { QueryClient } from '@tanstack/react-query'

import { profileQueryOptions } from '@/features/auth/queries'
import type { UserRoleT, UserT } from '@/features/auth/types'
import { APP_SCREENS } from '@/features/navigation/config/appNav'
import type { AppScreenPermissionRequirement } from '@/features/navigation/config/appNav'
import { parseRoleRules } from '@/features/permissions/api/permissionClient'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  getModuleKeys,
  getModuleWildcard,
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'
import type { PermissionCatalogItemT } from '@/features/permissions/types'

export function getCurrentUserRoleFromProfile(
  user: UserT | null | undefined,
): UserRoleT | null {
  if (!user?.userRoles?.length) {
    return null
  }

  return user.userRoles.find((role) => role.isCurrent) ?? user.userRoles[0]
}

export function getPermissionsFromUser(
  user: UserT | null | undefined,
): Array<string> {
  const currentRole = getCurrentUserRoleFromProfile(user)
  if (!currentRole?.role?.rules) {
    return []
  }

  return parseRoleRules(currentRole.role.rules).permissions
}

export function canAccessModule(
  permissions: Array<string>,
  module: string,
  catalog?: Array<PermissionCatalogItemT>,
): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (permissions.includes(getModuleWildcard(module))) {
    return true
  }

  if (catalog && catalog.length > 0) {
    const moduleKeys = getModuleKeys(catalog, module)
    if (moduleKeys.length === 0) {
      return permissions.some(
        (permission) =>
          permission === module || permission.startsWith(`${module}.`),
      )
    }

    return moduleKeys.some((key) =>
      isPermissionGranted(permissions, key, module),
    )
  }

  return permissions.some(
    (permission) =>
      permission === module || permission.startsWith(`${module}.`),
  )
}

export function canAccessScreen(
  permissions: Array<string>,
  requirement: ScreenPermissionRequirement,
  catalog?: Array<PermissionCatalogItemT>,
): boolean {
  if (requirement.permissionKey) {
    return isPermissionGranted(
      permissions,
      requirement.permissionKey,
      requirement.module,
    )
  }

  return canAccessModule(permissions, requirement.module, catalog)
}

export function canAccessAppScreen(
  permissions: Array<string>,
  requirement?: AppScreenPermissionRequirement,
  catalog?: Array<PermissionCatalogItemT>,
): boolean {
  if (!requirement) {
    return true
  }

  if (Array.isArray(requirement)) {
    return requirement.some((item) =>
      canAccessScreen(permissions, item, catalog),
    )
  }

  return canAccessScreen(permissions, requirement, catalog)
}

export function getFirstAccessibleAppRoute(
  permissions: Array<string>,
  catalog?: Array<PermissionCatalogItemT>,
): string | null {
  for (const screen of APP_SCREENS) {
    if (!canAccessAppScreen(permissions, screen.requiredPermission, catalog)) {
      continue
    }

    if (screen.children?.length) {
      return screen.children[0].to
    }

    if (screen.to) {
      return screen.to
    }
  }

  return null
}

export async function loadPermissionContext(queryClient: QueryClient) {
  const user = await queryClient.ensureQueryData(profileQueryOptions)
  const permissions = getPermissionsFromUser(user)

  return { user, permissions }
}

export function resolvePermissionFallbackPath(
  permissions: Array<string>,
  catalog?: Array<PermissionCatalogItemT>,
): string {
  const accessibleRoute = getFirstAccessibleAppRoute(permissions, catalog)
  return accessibleRoute ?? '/access-denied'
}
