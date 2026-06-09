import i18n from '@/lib/i18n/config'

const MODULE_KEY_BY_ID: Record<string, string> = {
  audit_logs: 'modules.audit_logs',
  'data-entry': 'modules.data-entry',
  dossiers: 'modules.dossiers',
  folders: 'modules.folders',
  groups: 'modules.groups',
  roles: 'modules.roles',
  users: 'modules.users',
}

export function getModuleLabel(module: string): string {
  const key = MODULE_KEY_BY_ID[module]
  if (key) {
    return i18n.t(key, { ns: 'permissions' } as never)
  }

  return module
}
