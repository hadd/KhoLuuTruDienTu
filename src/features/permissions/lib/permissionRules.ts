import {
  getModuleLabelFromCatalog,
} from '@/features/permissions/lib/moduleLabels'
import type { PermissionCatalogItemT } from '@/features/permissions/types'

export const FULL_ACCESS_PERMISSION = '*'

export function getModuleWildcard(module: string): string {
  return `${module}.*`
}

export function hasFullAccess(permissions: Array<string>): boolean {
  return permissions.includes(FULL_ACCESS_PERMISSION)
}

export function groupCatalogByModule(
  catalog: Array<PermissionCatalogItemT>,
): Map<string, Array<PermissionCatalogItemT>> {
  const grouped = new Map<string, Array<PermissionCatalogItemT>>()

  for (const item of catalog) {
    const current = grouped.get(item.module) ?? []
    current.push(item)
    grouped.set(item.module, current)
  }

  return grouped
}

export function sortModulesForDisplay(modules: Array<string>): Array<string> {
  return [...modules].sort((a, b) => {
    if (a === 'projects' && b === 'metadata') {
      return -1
    }
    if (a === 'metadata' && b === 'projects') {
      return 1
    }
    return a.localeCompare(b)
  })
}

export function getModuleKeys(
  catalog: Array<PermissionCatalogItemT>,
  module: string,
): Array<string> {
  return catalog.filter((item) => item.module === module).map((item) => item.key)
}

const SIDEBAR_PERMISSION_THRESHOLD = 0.5
const SIDEBAR_FULL_ACCESS_MODULES = new Set(['roles'])

function isViewPermissionKey(key: string): boolean {
  return key.endsWith('.read') || key.endsWith('.view')
}

export function getModuleViewPermissionKey(
  catalog: Array<PermissionCatalogItemT>,
  module: string,
): string | null {
  const moduleItems = catalog.filter((item) => item.module === module)
  if (moduleItems.length === 0) {
    return null
  }

  const viewItem = moduleItems.find((item) => isViewPermissionKey(item.key))
  return viewItem?.key ?? moduleItems[0]?.key ?? null
}

export function countGrantedModulePermissions(
  permissions: Array<string>,
  module: string,
  catalog: Array<PermissionCatalogItemT>,
): number {
  const moduleKeys = getModuleKeys(catalog, module)
  return moduleKeys.filter((key) => permissions.includes(key)).length
}

export function canAccessModuleForSidebar(
  permissions: Array<string>,
  module: string,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (permissions.includes(getModuleWildcard(module))) {
    return true
  }

  const moduleKeys = getModuleKeys(catalog, module)

  if (SIDEBAR_FULL_ACCESS_MODULES.has(module)) {
    if (moduleKeys.length === 0) {
      return false
    }
    return isModuleFullyGranted(permissions, module, moduleKeys)
  }

  if (moduleKeys.length === 0) {
    return permissions.some(
      (permission) =>
        permission === module || permission.startsWith(`${module}.`),
    )
  }

  const viewKey = getModuleViewPermissionKey(catalog, module)
  if (!viewKey) {
    return false
  }

  if (!isPermissionGranted(permissions, viewKey, module)) {
    return false
  }

  const grantedCount = countGrantedModulePermissions(permissions, module, catalog)
  return (
    grantedCount >= 2 ||
    grantedCount / moduleKeys.length >= SIDEBAR_PERMISSION_THRESHOLD
  )
}

export function isPermissionGranted(
  permissions: Array<string>,
  permissionKey: string,
  module: string,
): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (permissions.includes(getModuleWildcard(module))) {
    return true
  }

  return permissions.includes(permissionKey)
}

export function isModuleFullyGranted(
  permissions: Array<string>,
  module: string,
  moduleKeys: Array<string>,
): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (permissions.includes(getModuleWildcard(module))) {
    return true
  }

  if (moduleKeys.length === 0) {
    return false
  }

  return moduleKeys.every((key) => permissions.includes(key))
}

export function getModuleCheckState(
  permissions: Array<string>,
  module: string,
  moduleKeys: Array<string>,
): boolean | 'indeterminate' {
  if (isModuleFullyGranted(permissions, module, moduleKeys)) {
    return true
  }

  const hasAny = moduleKeys.some((key) =>
    isPermissionGranted(permissions, key, module),
  )

  return hasAny ? 'indeterminate' : false
}

function withoutModuleEntries(
  permissions: Array<string>,
  module: string,
  moduleKeys: Array<string>,
): Array<string> {
  const moduleWildcard = getModuleWildcard(module)
  const moduleKeySet = new Set(moduleKeys)

  return permissions.filter(
    (permission) =>
      permission !== moduleWildcard && !moduleKeySet.has(permission),
  )
}

function expandFullAccessExceptModules(
  catalog: Array<PermissionCatalogItemT>,
  excludedModules: Set<string>,
): Array<string> {
  return catalog
    .filter((item) => !excludedModules.has(item.module))
    .map((item) => item.key)
}

export function setModuleGranted(
  permissions: Array<string>,
  module: string,
  moduleKeys: Array<string>,
  granted: boolean,
  catalog: Array<PermissionCatalogItemT>,
): Array<string> {
  if (granted) {
    if (hasFullAccess(permissions)) {
      return permissions
    }

    const next = withoutModuleEntries(permissions, module, moduleKeys)
    next.push(getModuleWildcard(module))
    return next
  }

  if (hasFullAccess(permissions)) {
    return expandFullAccessExceptModules(catalog, new Set([module]))
  }

  return withoutModuleEntries(permissions, module, moduleKeys)
}

export function setPermissionGranted(
  permissions: Array<string>,
  permissionKey: string,
  module: string,
  moduleKeys: Array<string>,
  granted: boolean,
  catalog: Array<PermissionCatalogItemT>,
): Array<string> {
  const moduleWildcard = getModuleWildcard(module)

  if (granted) {
    if (hasFullAccess(permissions) || permissions.includes(moduleWildcard)) {
      return permissions
    }

    const next = [...permissions, permissionKey]

    if (moduleKeys.every((key) => next.includes(key))) {
      return [...withoutModuleEntries(next, module, moduleKeys), moduleWildcard]
    }

    return next
  }

  if (hasFullAccess(permissions)) {
    return catalog
      .filter((item) => item.key !== permissionKey)
      .map((item) => item.key)
  }

  if (permissions.includes(moduleWildcard)) {
    return [
      ...withoutModuleEntries(permissions, module, moduleKeys),
      ...moduleKeys.filter((key) => key !== permissionKey),
    ]
  }

  return permissions.filter((permission) => permission !== permissionKey)
}

export function filterCatalogBySearch(
  catalog: Array<PermissionCatalogItemT>,
  searchQuery: string,
): Array<PermissionCatalogItemT> {
  const query = searchQuery.trim().toLowerCase()
  if (!query) {
    return catalog
  }

  return catalog.filter((item) => {
    const moduleLabel = getModuleLabelFromCatalog(catalog, item.module).toLowerCase()

    return (
      item.key.toLowerCase().includes(query) ||
      item.module.toLowerCase().includes(query) ||
      moduleLabel.includes(query) ||
      item.label.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    )
  })
}
