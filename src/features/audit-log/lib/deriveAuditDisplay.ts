import type { TFunction } from 'i18next'

import type { AuditLogT } from '@/features/audit-log/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC_RE = /^\d+$/

const MODULE_PATH_ALIASES: Record<string, string> = {
  'archive-warehouse': 'archive',
  'archive-submissions': 'archive',
  'archive-submission': 'archive',
}

const ADMIN_RESOURCE_ALIASES: Record<string, string> = {
  users: 'users',
  roles: 'roles',
  permissions: 'roles',
  'metadata-templates': 'metadata',
  'metadata-permission-configs': 'metadata',
  'metadata-export-presets': 'metadata',
  'document-naming-configs': 'metadata',
  'archive-field-config': 'metadata',
  groups: 'groups',
  projects: 'projects',
  'issue-reports': 'issue-reports',
  'archive-acl': 'archive',
  watermark: 'watermark',
  'notification-configs': 'notifications',
  'audit-logs': 'audit-log',
  'audit-log-config': 'audit-log-config',
}

type PathSummaryRule = {
  method: string
  pattern: string
  module?: string
  eventType?: string
  summaryKey: string
}

const PATH_SUMMARY_RULES: PathSummaryRule[] = [
  { method: 'GET', pattern: '/archive-warehouse/fonds', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveFonds' },
  { method: 'GET', pattern: '/archive-warehouse/dossier-types', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossierTypes' },
  { method: 'GET', pattern: '/archive-warehouse/dossier-types/:id/summary', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossierTypeSummary' },
  { method: 'GET', pattern: '/archive-warehouse/document-types', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDocumentTypes' },
  { method: 'GET', pattern: '/archive-warehouse/document-types/:id/summary', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDocumentTypeSummary' },
  { method: 'GET', pattern: '/archive-warehouse/fonds/:id/summary', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveFondSummary' },
  { method: 'GET', pattern: '/archive-warehouse/dossiers', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossiers' },
  { method: 'GET', pattern: '/archive-warehouse/dossiers/unassigned', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossiersUnassigned' },
  { method: 'GET', pattern: '/archive-warehouse/dossiers/by-dossier-type', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossiersByType' },
  { method: 'GET', pattern: '/archive-warehouse/documents/by-document-type', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDocumentsByType' },
  { method: 'GET', pattern: '/archive-warehouse/dossiers/:id', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveDossierDetail' },
  { method: 'GET', pattern: '/archive-warehouse/search', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveSearch' },
  { method: 'GET', pattern: '/physical-warehouse/items', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalItems' },
  { method: 'GET', pattern: '/physical-warehouse/items/tree', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalTree' },
  { method: 'GET', pattern: '/physical-warehouse/items/stats', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalStats' },
  { method: 'GET', pattern: '/physical-warehouse/items/:id', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalItemDetail' },
  { method: 'GET', pattern: '/physical-warehouse/placements', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalPlacements' },
  { method: 'GET', pattern: '/physical-warehouse/placements/unplaced', module: 'physical-warehouse', eventType: 'view', summaryKey: 'pathSummaries.physicalUnplaced' },
  { method: 'GET', pattern: '/inventories', module: 'inventories', eventType: 'view', summaryKey: 'pathSummaries.inventories' },
  { method: 'GET', pattern: '/inventories/active', module: 'inventories', eventType: 'view', summaryKey: 'pathSummaries.inventoriesActive' },
  { method: 'GET', pattern: '/inventories/:id', module: 'inventories', eventType: 'view', summaryKey: 'pathSummaries.inventoryDetail' },
  { method: 'GET', pattern: '/fonds', module: 'fonds', eventType: 'view', summaryKey: 'pathSummaries.fonds' },
  { method: 'GET', pattern: '/fonds/:id', module: 'fonds', eventType: 'view', summaryKey: 'pathSummaries.fondDetail' },
  { method: 'GET', pattern: '/retention-periods', module: 'retention-periods', eventType: 'view', summaryKey: 'pathSummaries.retentionPeriods' },
  { method: 'GET', pattern: '/retention-periods/:id', module: 'retention-periods', eventType: 'view', summaryKey: 'pathSummaries.retentionPeriodDetail' },
  { method: 'GET', pattern: '/data-entry/maker/claim', module: 'data-entry', eventType: 'view', summaryKey: 'pathSummaries.dataEntryClaim' },
  { method: 'GET', pattern: '/data-entry/maker/dossiers/:id', module: 'data-entry', eventType: 'view', summaryKey: 'pathSummaries.dataEntryMakerDossier' },
  { method: 'POST', pattern: '/data-entry/checker/approve/:id', module: 'data-entry', eventType: 'approve', summaryKey: 'pathSummaries.dataEntryApprove' },
  { method: 'POST', pattern: '/data-entry/checker/reject/:id', module: 'data-entry', eventType: 'reject', summaryKey: 'pathSummaries.dataEntryReject' },
  { method: 'PUT', pattern: '/dossiers/:id/metadata', module: 'data-entry', eventType: 'edit', summaryKey: 'pathSummaries.dataEntrySubmit' },
  { method: 'POST', pattern: '/dossiers/assignments/drafts/submit', module: 'data-entry', eventType: 'edit', summaryKey: 'pathSummaries.dataEntryBulkSubmit' },
  { method: 'GET', pattern: '/archive-submissions/pending', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveSubmissionsPending' },
  { method: 'GET', pattern: '/archive-submissions/dossiers', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveSubmissionsDossiers' },
  { method: 'GET', pattern: '/archive-submissions/dossier/:id/prepare', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveSubmitPrepare' },
  { method: 'POST', pattern: '/archive-submissions/physical-location/place', module: 'archive', eventType: 'place_physical', summaryKey: 'pathSummaries.archivePlacePhysical' },
  { method: 'POST', pattern: '/archive-submissions/physical-location/move', module: 'archive', eventType: 'move_physical', summaryKey: 'pathSummaries.archiveMovePhysical' },
  { method: 'POST', pattern: '/archive-submissions/physical-location/remove', module: 'archive', eventType: 'remove_physical', summaryKey: 'pathSummaries.archiveRemovePhysical' },
  { method: 'POST', pattern: '/issue-reports/:id/confirm', module: 'issue-reports', eventType: 'confirm', summaryKey: 'pathSummaries.issueConfirm' },
  { method: 'POST', pattern: '/issue-reports/:id/reject', module: 'issue-reports', eventType: 'reject', summaryKey: 'pathSummaries.issueReject' },
  { method: 'POST', pattern: '/issue-reports/:id/escalate', module: 'issue-reports', eventType: 'escalate', summaryKey: 'pathSummaries.issueEscalate' },
  { method: 'GET', pattern: '/issue-reports/dossier/:dossierId', module: 'issue-reports', eventType: 'view', summaryKey: 'pathSummaries.issueReportsForDossier' },
  { method: 'GET', pattern: '/folders', module: 'folders', eventType: 'view', summaryKey: 'pathSummaries.foldersList' },
  { method: 'GET', pattern: '/folders/:id', module: 'folders', eventType: 'view', summaryKey: 'pathSummaries.folderDetail' },
  { method: 'GET', pattern: '/scan-intake/sessions', module: 'scan-intake', eventType: 'view', summaryKey: 'pathSummaries.scanSessions' },
  { method: 'GET', pattern: '/scan-intake/session', module: 'scan-intake', eventType: 'view', summaryKey: 'pathSummaries.scanSessionDetail' },
  { method: 'GET', pattern: '/digital-sign/status/:dossierId', module: 'digital-sign', eventType: 'view', summaryKey: 'pathSummaries.digitalSignStatus' },
  { method: 'GET', pattern: '/digital-sign/history/:dossierId', module: 'digital-sign', eventType: 'view', summaryKey: 'pathSummaries.digitalSignHistory' },
  { method: 'GET', pattern: '/dossier-types', module: 'dossier-types', eventType: 'view', summaryKey: 'pathSummaries.dossierTypesList' },
  { method: 'GET', pattern: '/dossier-types/:id', module: 'dossier-types', eventType: 'view', summaryKey: 'pathSummaries.dossierTypeDetail' },
  { method: 'GET', pattern: '/document-types', module: 'document-types', eventType: 'view', summaryKey: 'pathSummaries.documentTypesList' },
  { method: 'GET', pattern: '/document-types/:id', module: 'document-types', eventType: 'view', summaryKey: 'pathSummaries.documentTypeDetail' },
  { method: 'GET', pattern: '/security-levels', module: 'security-levels', eventType: 'view', summaryKey: 'pathSummaries.securityLevelsList' },
  { method: 'GET', pattern: '/security-levels/:id', module: 'security-levels', eventType: 'view', summaryKey: 'pathSummaries.securityLevelDetail' },
  { method: 'GET', pattern: '/security-permission-defs', module: 'security-levels', eventType: 'view', summaryKey: 'pathSummaries.securityPermissionDefs' },
  { method: 'GET', pattern: '/notifications', module: 'notifications', eventType: 'view', summaryKey: 'pathSummaries.notificationsInbox' },
  { method: 'GET', pattern: '/admin/roles/:id/permissions', module: 'roles', eventType: 'view', summaryKey: 'pathSummaries.rolePermissions' },
  { method: 'GET', pattern: '/admin/metadata-templates', module: 'metadata', eventType: 'view', summaryKey: 'pathSummaries.metadataTemplatesList' },
  { method: 'GET', pattern: '/admin/metadata-templates/:id', module: 'metadata', eventType: 'view', summaryKey: 'pathSummaries.metadataTemplateDetail' },
  { method: 'GET', pattern: '/admin/groups', module: 'groups', eventType: 'view', summaryKey: 'pathSummaries.groupsList' },
  { method: 'GET', pattern: '/admin/groups/:id', module: 'groups', eventType: 'view', summaryKey: 'pathSummaries.groupDetail' },
  { method: 'GET', pattern: '/admin/projects', module: 'projects', eventType: 'view', summaryKey: 'pathSummaries.projectsList' },
  { method: 'GET', pattern: '/admin/projects/:id', module: 'projects', eventType: 'view', summaryKey: 'pathSummaries.projectDetail' },
  { method: 'GET', pattern: '/admin/audit-logs', module: 'audit-log', eventType: 'view', summaryKey: 'pathSummaries.auditLogsList' },
  { method: 'GET', pattern: '/admin/audit-log-config', module: 'audit-log-config', eventType: 'view', summaryKey: 'pathSummaries.auditLogConfig' },
  { method: 'GET', pattern: '/admin/archive-acl/matrix', module: 'archive', eventType: 'view', summaryKey: 'pathSummaries.archiveAclMatrix' },
]

function normalizePathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const apiIndex = segments.indexOf('api')
  if (apiIndex >= 0 && segments[apiIndex + 1] === 'v1') {
    return `/${segments.slice(apiIndex + 2).join('/')}`
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split('/').filter(Boolean)
  const regexParts = parts.map((part) => {
    if (part.startsWith(':')) return '([^/]+)'
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })
  return new RegExp(`^/${regexParts.join('/')}$`)
}

function isIdSegment(segment: string): boolean {
  return UUID_RE.test(segment) || NUMERIC_RE.test(segment)
}

function normalizeModule(module: string | null | undefined): string | null {
  if (!module) return null
  const key = module.replace(/_/g, '-')
  return MODULE_PATH_ALIASES[key] ?? key
}

function moduleFromPath(pathname: string): string | null {
  const segments = normalizePathname(pathname).split('/').filter(Boolean)
  if (segments[0] === 'admin') {
    const adminResource = segments[1]
    if (!adminResource) return 'admin'
    return normalizeModule(ADMIN_RESOURCE_ALIASES[adminResource] ?? adminResource)
  }
  const resource = segments[0]
  if (!resource) return null
  return normalizeModule(resource)
}

function eventTypeFromMethod(method: string): string {
  const map: Record<string, string> = {
    GET: 'view',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  }
  return map[method.toUpperCase()] ?? method.toLowerCase()
}

function matchPathRule(method: string, pathname: string): PathSummaryRule | null {
  const normalizedPath = normalizePathname(pathname)
  const upperMethod = method.toUpperCase()
  for (const rule of PATH_SUMMARY_RULES) {
    if (rule.method.toUpperCase() !== upperMethod) continue
    if (patternToRegex(rule.pattern).test(normalizedPath)) return rule
  }
  return null
}

function genericSummary(method: string, pathname: string, t: TFunction<'audit-log'>): string {
  const segments = normalizePathname(pathname).split('/').filter(Boolean)
  const withoutMeta = segments.filter((s) => s !== 'admin')

  let leaf = withoutMeta[withoutMeta.length - 1] ?? 'resource'
  let hasId = withoutMeta.some(isIdSegment)

  const prev = withoutMeta[withoutMeta.length - 2]
  const knownResources = new Set([
    'fonds',
    'dossier-types',
    'document-types',
    'dossiers',
    'documents',
    'files',
    'search',
    'inventories',
    'items',
    'placements',
    'retention-periods',
    'users',
    'roles',
    'security-levels',
    'notifications',
    'unplaced',
    'unassigned',
    'tree',
    'stats',
    'summary',
    'folders',
    'sessions',
    'session',
    'groups',
    'projects',
    'metadata-templates',
    'metadata-permission-configs',
    'metadata-export-presets',
    'document-naming-configs',
    'audit-logs',
    'audit-log-config',
    'security-permission-defs',
  ])

  if (
    leaf &&
    prev &&
    !knownResources.has(leaf) &&
    !isIdSegment(leaf) &&
    (knownResources.has(prev) || prev.includes('-'))
  ) {
    hasId = true
    leaf = prev
  } else if (isIdSegment(leaf) && prev) {
    hasId = true
    leaf = prev
  }

  const resource = t(`resources.${leaf}`, { defaultValue: leaf.replace(/-/g, ' ') })
  const upper = method.toUpperCase()

  if (upper === 'GET') {
    if (leaf === 'search') return t('summaryTemplates.search', { resource })
    if (leaf === 'summary' || leaf === 'stats') {
      const parent = withoutMeta[withoutMeta.length - 2]
      const parentLabel = parent
        ? t(`resources.${parent}`, { defaultValue: parent.replace(/-/g, ' ') })
        : resource
      return t('summaryTemplates.stats', { resource: parentLabel })
    }
    return hasId
      ? t('summaryTemplates.detail', { resource })
      : t('summaryTemplates.list', { resource })
  }
  if (upper === 'POST') return t('summaryTemplates.create', { resource })
  if (upper === 'PUT' || upper === 'PATCH') return t('summaryTemplates.update', { resource })
  if (upper === 'DELETE') return t('summaryTemplates.delete', { resource })
  return `${upper} ${resource}`
}

export type AuditLogDisplayFields = {
  module: string | null
  eventType: string | null
  summary: string
}

function isIdOnlySummary(
  summary: string | null | undefined,
  entityId: string | null | undefined,
): boolean {
  if (!summary) return false
  const trimmed = summary.trim()
  if (entityId && trimmed === entityId) return true
  if (UUID_RE.test(trimmed)) return true
  return false
}

export function resolveAuditLogDisplay(
  log: Pick<AuditLogT, 'method' | 'path' | 'module' | 'eventType' | 'summary' | 'entityId'>,
  t: TFunction<'audit-log'>,
  unknownLabel: string,
): AuditLogDisplayFields {
  const rule = matchPathRule(log.method, log.path)

  const module = normalizeModule(log.module)
    ?? rule?.module
    ?? moduleFromPath(log.path)

  const eventType = log.eventType
    ?? rule?.eventType
    ?? eventTypeFromMethod(log.method)

  const rawSummary = log.summary
  const summary = isIdOnlySummary(rawSummary, log.entityId)
    ? (rule ? t(rule.summaryKey) : null)
      ?? genericSummary(log.method, log.path, t)
      ?? unknownLabel
    : rawSummary
      ?? (rule ? t(rule.summaryKey) : null)
      ?? genericSummary(log.method, log.path, t)
      ?? unknownLabel

  return { module, eventType, summary }
}
