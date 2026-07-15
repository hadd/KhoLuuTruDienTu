import type { QueryClient } from '@tanstack/react-query'

import { WAREHOUSE_MANAGEMENT_RELATED_PATHS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import type { AppRoleT } from '@/features/auth/constants'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { profileQueryOptions } from '@/features/auth/queries'
import type { UserRoleT, UserT } from '@/features/auth/types'
import { DATA_CONFIG_RELATED_PATHS } from '@/features/data-config/lib/dataConfigAccess'
import { canAccessDossierManagementScreen } from '@/features/data-management/lib/resolveDataManagementRole'
import { GENERAL_CATALOG_RELATED_PATHS } from '@/features/general-catalog/lib/generalCatalogAccess'
import type {
  AppScreen,
  AppScreenChild,
  AppScreenPermissionRequirement,
} from '@/features/navigation/config/appNav'
import {
  APP_SCREENS,
  isAlwaysVisibleScreen,
} from '@/features/navigation/config/appNav'
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

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function isPathWithinRoute(pathname: string, route: string): boolean {
  const normalizedPath = normalizePath(pathname)
  const normalizedRoute = normalizePath(route)
  return (
    normalizedPath === normalizedRoute ||
    normalizedPath.startsWith(`${normalizedRoute}/`)
  )
}

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
  primaryAppRole?: AppRoleT | null,
): boolean {
  if (
    child.id === 'document-types' ||
    child.id === 'document-assignment' ||
    child.requiredPermission?.module === 'metadata'
  ) {
    return isMetadataSidebarChildGranted(child.id, permissions, catalog)
  }

  // PM/admin operational: ACL kho nằm trong hub Kho dữ liệu.
  if (
    (child.id === 'archive-permission' || child.id === 'archive-warehouse') &&
    (primaryAppRole === 'admin' || primaryAppRole === 'manager')
  ) {
    return true
  }

  if (child.requiredPermission) {
    return canAccessAppScreenForSidebar(
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

  // PM/admin luôn thấy Quản lý kho (ACL kho dữ liệu).
  if (
    screen.id === 'warehouse-management' &&
    (primaryAppRole === 'admin' || primaryAppRole === 'manager')
  ) {
    return true
  }

  if (screen.id === 'data-config') {
    return (
      isMetadataSidebarChildGranted('document-types', permissions, catalog) ||
      isMetadataSidebarChildGranted(
        'document-assignment',
        permissions,
        catalog,
      ) ||
      isMetadataSidebarChildGranted(
        'metadata-export-presets',
        permissions,
        catalog,
      ) ||
      canAccessScreen(
        permissions,
        { module: 'roles', permissionKey: 'roles.manage' },
        catalog,
      ) ||
      canAccessScreen(
        permissions,
        { module: 'watermark', permissionKey: 'watermark.config.read' },
        catalog,
      )
    )
  }

  if (isAlwaysVisibleScreen(screen.id)) {
    return true
  }

  if (screen.children?.length) {
    return screen.children.some((child) =>
      isAppScreenChildVisibleOnSidebar(
        child,
        permissions,
        catalog,
        primaryAppRole,
      ),
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
        isAppScreenChildVisibleOnSidebar(
          child,
          permissions,
          resolvedCatalog,
          primaryAppRole,
        ),
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

export function getAccessibleSidebarRoutes(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): Array<string> {
  const routes: Array<string> = []

  for (const screen of APP_SCREENS) {
    if (
      !isAppScreenVisibleOnSidebar(screen, permissions, catalog, primaryAppRole)
    ) {
      continue
    }

    if (screen.to) {
      routes.push(screen.to)
      if (screen.id === 'warehouse-management') {
        routes.push(...WAREHOUSE_MANAGEMENT_RELATED_PATHS)
      }
      if (screen.id === 'general-catalog') {
        routes.push(...GENERAL_CATALOG_RELATED_PATHS)
      }
      if (screen.id === 'data-config') {
        routes.push(...DATA_CONFIG_RELATED_PATHS)
      }
    }

    if (screen.children?.length) {
      const childRoutes = screen.children
        .filter((child) =>
          isAppScreenChildVisibleOnSidebar(
            child,
            permissions,
            catalog,
            primaryAppRole,
          ),
        )
        .map((child) => child.to)
      routes.push(...childRoutes)
    }
  }

  return routes
}

export function canAccessPathBySidebar(
  pathname: string,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): boolean {
  const accessibleRoutes = getAccessibleSidebarRoutes(
    permissions,
    catalog,
    primaryAppRole,
  )
  return accessibleRoutes.some((route) => isPathWithinRoute(pathname, route))
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
