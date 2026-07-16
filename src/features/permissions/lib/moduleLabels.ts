import type { PermissionCatalogItemT } from '@/features/permissions/types'
import i18n from '@/lib/i18n/config'

const MODULE_I18N_OVERRIDES: Record<string, string> = {
  audit_logs: 'modules.audit_logs',
  dashboard: 'modules.dashboard',
  'data-entry': 'modules.data-entry',
  dossiers: 'modules.dossiers',
  folders: 'modules.folders',
  groups: 'modules.groups',
  metadata: 'modules.metadata',
    projects: 'modules.projects',
    'project-plans': 'modules.project-plans',
    fonds: 'modules.fonds',
    'retention-periods': 'modules.retention-periods',
    inventories: 'modules.inventories',
    'dossier-types': 'modules.dossier-types',
    'document-types': 'modules.document-types',
    archive: 'modules.archive',
    'archive.warehouse': 'modules.archive_warehouse',
    roles: 'modules.roles',
    'scan-intake': 'modules.scan-intake',
    users: 'modules.users',
}

function humanizeModuleId(module: string): string {
  return module
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getTranslatedModuleLabel(module: string): string | null {
  const i18nKey = MODULE_I18N_OVERRIDES[module]
  if (!i18nKey) {
    return null
  }

  const translated = i18n.t(i18nKey, { ns: 'permissions' } as never)
  return translated !== i18nKey ? translated : null
}

export function getModuleLabel(module: string): string {
  return getTranslatedModuleLabel(module) ?? humanizeModuleId(module)
}

export function getModuleLabelFromCatalog(
  catalog: Array<PermissionCatalogItemT>,
  module: string,
): string {
  const translated = getTranslatedModuleLabel(module)
  if (translated) {
    return translated
  }

  const firstItem = catalog.find((item) => item.module === module)
  if (firstItem?.label) {
    const parts = firstItem.label.trim().split(/\s+/)
    if (parts.length > 1) {
      return parts.slice(1).join(' ')
    }
  }

  return humanizeModuleId(module)
}
