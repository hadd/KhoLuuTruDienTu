import type { QueryClient } from '@tanstack/react-query'

import type { AppRoleT } from '@/features/auth/constants'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { profileQueryOptions } from '@/features/auth/queries'
import type { UserRoleT, UserT } from '@/features/auth/types'
import type {
  NavLinkNode,
  NavNode,
} from '@/features/navigation/config/appNavTree'
import {
  APP_NAV_TREE,
  collectNavLinkNodes,
  getNavRoutesForLink,
} from '@/features/navigation/config/appNavTree'
import { getVisibleDataConfigNavItemDefs } from '@/features/navigation/config/dataConfigNavItems'
import { DIGITIZATION_SCREEN_REQUIREMENTS } from '@/features/digitization/lib/digitizationAccess'
import { GENERAL_CATALOG_SCREEN_REQUIREMENTS } from '@/features/general-catalog/lib/generalCatalogAccess'
import { PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/project-management/lib/projectManagementAccess'
import type {
  AppScreen,
  AppScreenChild,
  AppScreenPermissionRequirement,
} from '@/features/navigation/config/appNav'
import { isAlwaysVisibleScreen } from '@/features/navigation/config/appNav'
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
  if (!user?.userRoles?.length) {
    return []
  }

  const merged = new Set<string>()
  for (const userRole of user.userRoles) {
    for (const permission of parseRoleRules(userRole.role?.rules).permissions) {
      merged.add(permission)
    }
  }

  return [...merged]
}

export function getCurrentUserRoleId(
  user: UserT | null | undefined,
): string | null {
  const currentRole = getCurrentUserRoleFromProfile(user)
  return currentRole?.roleId ?? currentRole?.role?.id ?? null
}

export function getUserRoleIdsFromProfile(
  user: UserT | null | undefined,
): Array<string> {
  if (!user?.userRoles?.length) {
    return []
  }

  return [
    ...new Set(
      user.userRoles
        .map((userRole) => userRole.roleId ?? userRole.role?.id)
        .filter((roleId): roleId is string => Boolean(roleId)),
    ),
  ]
}

export function resolvePermissionsForUser(
  user: UserT | null | undefined,
  rolePermissions?: Array<string> | null,
): Array<string> {
  const fromProfile = getPermissionsFromUser(user)

  if (rolePermissions?.length) {
    return [...new Set([...fromProfile, ...rolePermissions])]
  }

  return fromProfile
}

export function getPrimaryAppRoleFromProfile(
  user: UserT | null | undefined,
): AppRoleT | null {
  const roleIds =
    user?.userRoles
      ?.map((userRole) => userRole.roleId ?? userRole.role?.id)
      .filter((roleId): roleId is string => Boolean(roleId)) ?? []

  if (roleIds.length === 0) {
    return null
  }

  return getPrimaryAppRole(roleIds)
}

export function isNavLinkVisibleOnSidebar(
  link: NavLinkNode,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): boolean {
  if (link.id === 'system-administration') {
    return isSystemAdminHubVisible(permissions, catalog)
  }

  if (link.id === 'digitization-hub') {
    return isDigitizationHubVisible(permissions, catalog)
  }

  if (link.visibilityTag === 'data-config') {
    return getVisibleDataConfigNavItemDefs(permissions, catalog).length > 0
  }

  if (
    link.visibilityTag === 'archive-warehouse-admin' &&
    (primaryAppRole === 'admin' || primaryAppRole === 'manager')
  ) {
    return true
  }

  if (
    link.id === 'warehouse-management' &&
    (primaryAppRole === 'admin' || primaryAppRole === 'manager')
  ) {
    return true
  }

  return canAccessAppScreenForSidebar(
    permissions,
    link.requiredPermission,
    catalog,
  )
}

export function isSystemAdminHubVisible(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (
    canAccessAppScreenForSidebar(
      permissions,
      [...GENERAL_CATALOG_SCREEN_REQUIREMENTS],
      catalog,
    )
  ) {
    return true
  }

  if (
    canAccessAppScreenForSidebar(
      permissions,
      { module: 'users', permissionKey: 'users.read' },
      catalog,
    )
  ) {
    return true
  }

  if (
    canAccessAppScreenForSidebar(permissions, { module: 'roles' }, catalog)
  ) {
    return true
  }

  if (
    canAccessAppScreenForSidebar(
      permissions,
      { module: 'audit_logs', permissionKey: 'audit_logs.read' },
      catalog,
    )
  ) {
    return true
  }

  return getVisibleDataConfigNavItemDefs(permissions, catalog).length > 0
}

export function isDigitizationHubVisible(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  return (
    canAccessAppScreenForSidebar(
      permissions,
      [...PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS],
      catalog,
    ) ||
    canAccessAppScreenForSidebar(
      permissions,
      [...DIGITIZATION_SCREEN_REQUIREMENTS],
      catalog,
    )
  )
}

export function isNavNodeVisibleOnSidebar(
  node: NavNode,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): boolean {
  if (node.type === 'link') {
    return isNavLinkVisibleOnSidebar(
      node,
      permissions,
      catalog,
      primaryAppRole,
    )
  }

  return node.children.some((child) =>
    isNavLinkVisibleOnSidebar(child, permissions, catalog, primaryAppRole),
  )
}

export function getVisibleNavTree(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): Array<NavNode> {
  return APP_NAV_TREE.map((node) => {
    if (node.type === 'group') {
      return {
        ...node,
        children: node.children.filter((child) =>
          isNavLinkVisibleOnSidebar(
            child,
            permissions,
            catalog,
            primaryAppRole,
          ),
        ),
      }
    }
    return node
  }).filter((node) => isNavNodeVisibleOnSidebar(node, permissions, catalog, primaryAppRole))
}

function isMetadataPermissionRequirement(
  requirement?: AppScreenPermissionRequirement,
): boolean {
  if (!requirement) return false
  if (Array.isArray(requirement)) {
    return requirement.some((item) => item.module === 'metadata')
  }
  return requirement.module === 'metadata'
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
    isMetadataPermissionRequirement(child.requiredPermission)
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
  // PM/admin luôn thấy Quản lý kho (ACL kho dữ liệu).
  if (
    screen.id === 'warehouse-management' &&
    (primaryAppRole === 'admin' || primaryAppRole === 'manager')
  ) {
    return true
  }

  if (screen.id === 'data-config') {
    return getVisibleDataConfigNavItemDefs(permissions, catalog).length > 0
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
  const tree = getVisibleNavTree(
    permissions,
    resolvedCatalog,
    primaryAppRole ?? null,
  )
  const links = collectNavLinkNodes(tree)
  return links[0]?.to ?? null
}

export function getAccessibleSidebarRoutes(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
  primaryAppRole: AppRoleT | null,
): Array<string> {
  const tree = getVisibleNavTree(permissions, catalog, primaryAppRole)
  const links = collectNavLinkNodes(tree)
  const routes = new Set<string>()
  for (const link of links) {
    for (const route of getNavRoutesForLink(link)) {
      routes.add(route)
    }
  }
  routes.add('/app/warehouse-management')
  routes.add('/app/system-admin')
  routes.add('/app/digitization-hub')
  return [...routes]
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
  const roleIds = getUserRoleIdsFromProfile(user)
  const merged = new Set(getPermissionsFromUser(user))

  await Promise.all(
    roleIds.map(async (roleId) => {
      try {
        const rolePermissions = await queryClient.ensureQueryData(
          rolePermissionsQueryOptions(roleId),
        )
        for (const permission of rolePermissions.rules.permissions) {
          merged.add(permission)
        }
      } catch {
        // Ignore role permission fetch failures; profile rules may still apply.
      }
    }),
  )

  return { user, permissions: [...merged] }
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
