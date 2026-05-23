import i18n from '@/lib/i18n/config'

const ROLE_KEY_BY_ID: Record<string, string> = {
  admin: 'roles.admin',
  qc: 'roles.qc',
  editer: 'roles.editer',
}

const ROLE_ID_BY_NAME: Record<string, string> = {
  Administrator: 'admin',
  'Quality Control': 'qc',
  'Document Editer': 'editer',
}

export function getRoleLabel(
  roleId?: string | null,
  roleName?: string | null,
): string | null {
  const normalizedId = roleId?.toLowerCase()
  if (normalizedId && ROLE_KEY_BY_ID[normalizedId]) {
    return i18n.t(ROLE_KEY_BY_ID[normalizedId], { ns: 'user' } as any)
  }

  if (roleName && ROLE_ID_BY_NAME[roleName]) {
    const key = ROLE_KEY_BY_ID[ROLE_ID_BY_NAME[roleName]]
    if (key) return i18n.t(key, { ns: 'user' } as any)
  }

  return roleName ?? roleId ?? null
}
