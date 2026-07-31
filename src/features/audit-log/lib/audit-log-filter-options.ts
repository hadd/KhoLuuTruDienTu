export const BASIC_AUDIT_EVENT_TYPES = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'login_failed',
] as const

export function getEventOptionsForModule(
  module: string,
  filterOptions?: {
    basicActions: Array<string>
    modules: Record<string, Array<string>>
  },
): Array<string> {
  if (!filterOptions) {
    return module ? [] : [...BASIC_AUDIT_EVENT_TYPES]
  }
  if (!module) {
    return filterOptions.basicActions
  }
  return filterOptions.modules[module] ?? []
}

export function isValidEventTypeForModule(
  eventType: string,
  module: string,
  filterOptions?: {
    basicActions: Array<string>
    modules: Record<string, Array<string>>
  },
): boolean {
  if (!eventType) return true
  const options = getEventOptionsForModule(module, filterOptions)
  return options.includes(eventType)
}
