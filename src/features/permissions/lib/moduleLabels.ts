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
  'physical-warehouse': 'modules.physical-warehouse',
  notifications: 'modules.notifications',
  watermark: 'modules.watermark',
  roles: 'modules.roles',
  'scan-intake': 'modules.scan-intake',
  users: 'modules.users',
}

/** Multi-word action prefixes stripped before single-word fallback (e.g. "Cấu hình"). */
const ACTION_PREFIXES = [
  'Cấu hình',
  'Quản lý',
  'Phân công',
  'Upload lại',
  'Hiển thị',
] as const

function humanizeModuleId(module: string): string {
  return module
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function capitalizeFirstLetter(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function deriveModuleLabelFromPermissionLabel(label: string): string {
  const trimmed = label.trim()
  for (const prefix of ACTION_PREFIXES) {
    if (trimmed === prefix) {
      return trimmed
    }
    if (trimmed.startsWith(`${prefix} `)) {
      return capitalizeFirstLetter(trimmed.slice(prefix.length + 1))
    }
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length > 1) {
    return capitalizeFirstLetter(parts.slice(1).join(' '))
  }

  return trimmed
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
    return deriveModuleLabelFromPermissionLabel(firstItem.label)
  }

  return humanizeModuleId(module)
}
