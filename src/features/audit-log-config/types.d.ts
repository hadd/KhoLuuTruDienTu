export type AuditLogConfigActionT = {
  module: string
  actionKey: string
  label: string
  enabled: boolean
}

export type AuditLogConfigGroupT = {
  module: string
  moduleLabel: string
  actions: Array<AuditLogConfigActionT>
}

export type AuditLogSettingsT = {
  retentionDays: number
  lastPurgeAt: string | null
}

export type AuditLogConfigResponseT = {
  groups: Array<AuditLogConfigGroupT>
  settings: AuditLogSettingsT
}
