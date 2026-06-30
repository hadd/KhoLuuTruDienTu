import type { QueryClient } from '@tanstack/react-query'

import { getPrimaryAppRole, type AppRoleT } from '@/features/auth/constants'
import { profileQueryOptions } from '@/features/auth/queries'
import type { UserRoleT, UserT } from '@/features/auth/types'
import {
  APP_SCREENS,
  isAlwaysVisibleScreen,
  type AppScreen,
  type AppScreenChild,
  type AppScreenPermissionRequirement,
} from '@/features/navigation/config/appNav'
import {
  canAccessDataManagementScreen,
  canAccessDossierManagementScreen,
} from '@/features/data-management/lib/resolveDataManagementRole'
import { isMetadataSidebarChildGranted } from '@/features/navigation/config/sidebarMetadataPermissions'
import { parseRoleRules } from '@/features/permissions/api/permissionClient'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'
import {
  canAccessModuleForSidebar,
  getModuleKeys,
  getModuleWildcard,
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
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

export function getCurrentUserRoleId(
  user: UserT | null | undefined,
): string | null {
  const currentRole = getCurrentUserRoleFromProfile(user)
  return currentRole?.roleId ?? currentRole?.role?.id ?? null
}

export function resolvePermissionsForUser(
  user: UserT | null | undefined,
  rolePermissions?: Array<string> | null,
): Array<string> {
  if (rolePermissions?.length) {
    return rolePermissions
  }

  return getPermissionsFromUser(user)
}

export function getPrimaryAppRoleFromProfile(
  user: UserT | null | undefined,
): AppRoleT | null {
  const currentRole = getCurrentUserRoleFromProfile(user)
  const roleId = currentRole?.roleId ?? currentRole?.role?.id
  if (!roleId) {
    return null
  }
  return getPrimaryAppRole([roleId])
}

export function isAppScreenChildVisibleOnSidebar(
  child: AppScreenChild,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (
    child.id === 'document-types' ||
    child.id === 'document-assignment' ||
    child.requiredPermission?.module === 'metadata'
  ) {
    return isMetadataSidebarChildGranted(child.id, permissions, catalog)
  }

  if (child.requiredPermission) {
    return canAccessScreenForSidebar(
      permissions,
      child.requiredPermission,
      catalog,
    )
  }

  return false
}

export function isAppScreenVisibleOnSidebar(
  screen: AppScreen,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): boolean {
  if (screen.id === 'dossiers') {
    return canAccessDossierManagementScreen(permissions, primaryAppRole)
  }

  if (screen.id === 'data') {
    return canAccessDataManagementScreen(permissions, primaryAppRole)
  }

  if (isAlwaysVisibleScreen(screen.id)) {
    return true
  }

  if (screen.children?.length) {
    return screen.children.some((child) =>
      isAppScreenChildVisibleOnSidebar(child, permissions, catalog),
    )
  }

  return canAccessAppScreenForSidebar(
    permissions,
    screen.requiredPermission,
    catalog,
  )
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

export function canAccessScreenForSidebar(
  permissions: Array<string>,
  requirement: ScreenPermissionRequirement,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (requirement.permissionKey) {
    return isPermissionGranted(
      permissions,
      requirement.permissionKey,
      requirement.module,
    )
  }

  return canAccessModuleForSidebar(permissions, requirement.module, catalog)
}

export function canAccessAppScreenForSidebar(
  permissions: Array<string>,
  requirement: AppScreenPermissionRequirement | undefined,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (!requirement) {
    return true
  }

  if (Array.isArray(requirement)) {
    return requirement.some((item) =>
      canAccessScreenForSidebar(permissions, item, catalog),
    )
  }

  return canAccessScreenForSidebar(permissions, requirement, catalog)
}

export function getFirstAccessibleAppRoute(
  permissions: Array<string>,
  catalog?: Array<PermissionCatalogItemT>,
  primaryAppRole?: AppRoleT | null,
): string | null {
  const resolvedCatalog = catalog ?? []

  for (const screen of APP_SCREENS) {
    if (
      !isAppScreenVisibleOnSidebar(
        screen,
        permissions,
        resolvedCatalog,
        primaryAppRole ?? null,
      )
    ) {
      continue
    }

    if (screen.children?.length) {
      const visibleChild = screen.children.find((child) =>
        isAppScreenChildVisibleOnSidebar(child, permissions, resolvedCatalog),
      )
      if (visibleChild) {
        return visibleChild.to
      }
      continue
    }

    if (screen.to) {
      return screen.to
    }
  }

  return null
}

export async function loadPermissionContext(queryClient: QueryClient) {
  const user = await queryClient.ensureQueryData(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  let permissions = getPermissionsFromUser(user)

  if (roleId) {
    const rolePermissions = await queryClient.ensureQueryData(
      rolePermissionsQueryOptions(roleId),
    )
    permissions = resolvePermissionsForUser(
      user,
      rolePermissions.rules.permissions,
    )
  }

  return { user, permissions }
}

export function resolvePermissionFallbackPath(
  permissions: Array<string>,
  catalog?: Array<PermissionCatalogItemT>,
  primaryAppRole?: AppRoleT | null,
): string {
  const accessibleRoute = getFirstAccessibleAppRoute(
    permissions,
    catalog,
    primaryAppRole,
  )
  return accessibleRoute ?? '/access-denied'
}
