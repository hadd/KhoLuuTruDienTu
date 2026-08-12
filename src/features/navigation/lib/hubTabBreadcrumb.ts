import {
  ARCHIVE_DISPOSAL_VIEWS,
  isArchiveDataHubTab,
} from '@/features/archive-warehouse/schemas'
import i18n from '@/lib/i18n/config'

export function normalizeAppPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function getSearchString(search: unknown, key: string): string | undefined {
  if (!search || typeof search !== 'object' || !(key in search)) {
    return undefined
  }
  const value = (search as Record<string, unknown>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const PATH_LEAF_CRUMBS: Record<string, { ns: string; key: string }> = {
  '/app/scan-intake': { ns: 'digitization', key: 'sectionTabs.scanIntake' },
  '/app/data': { ns: 'digitization', key: 'sectionTabs.dataManagement' },
  '/app/ocr-control': { ns: 'digitization', key: 'sectionTabs.ocrControl' },
  '/app/dossiers': { ns: 'digitization', key: 'sectionTabs.draftDossiers' },
  '/app/project-manager': {
    ns: 'project-management',
    key: 'sectionTabs.projects',
  },
  '/app/plan-management': {
    ns: 'project-management',
    key: 'sectionTabs.plans',
  },
  '/app/groups': { ns: 'project-management', key: 'sectionTabs.groups' },
  '/app/physical-warehouse': {
    ns: 'common',
    key: 'admin.physicalWarehouse',
  },
  '/app/archive-warehouse': {
    ns: 'common',
    key: 'admin.archiveWarehouse',
  },
  '/app/data-config/document-types': {
    ns: 'data-config',
    key: 'tiles.documentTypes',
  },
  '/app/data-config/document-assignment': {
    ns: 'data-config',
    key: 'tiles.documentAssignment',
  },
  '/app/data-config/metadata-export-presets': {
    ns: 'data-config',
    key: 'tiles.metadataExportPresets',
  },
  '/app/data-config/document-naming': {
    ns: 'data-config',
    key: 'tiles.documentNaming',
  },
  '/app/data-config/metadata-extract-settings': {
    ns: 'data-config',
    key: 'tiles.metadataExtractSettings',
  },
  '/app/data-config/notification-configs': {
    ns: 'data-config',
    key: 'tiles.notificationConfigs',
  },
  '/app/data-config/watermark-configs': {
    ns: 'data-config',
    key: 'tiles.watermarkConfigs',
  },
  '/app/data-config/audit-log-config': {
    ns: 'data-config',
    key: 'tiles.auditLogConfig',
  },
  '/app/data-config/borrow-approval-clearance': {
    ns: 'data-config',
    key: 'tiles.borrowApprovalClearance',
  },
  '/app/archive-fonds': {
    ns: 'general-catalog',
    key: 'tiles.fonds',
  },
  '/app/retention-periods': {
    ns: 'general-catalog',
    key: 'tiles.retention',
  },
  '/app/inventories': {
    ns: 'general-catalog',
    key: 'tiles.inventory',
  },
  '/app/dossier-types': {
    ns: 'general-catalog',
    key: 'tiles.dossierType',
  },
  '/app/document-types': {
    ns: 'general-catalog',
    key: 'tiles.documentType',
  },
  '/app/security-levels': {
    ns: 'general-catalog',
    key: 'tiles.securityLevel',
  },
}

export function getHubTabBreadcrumb(
  pathname: string,
  search: unknown,
): Array<{ label: string }> {
  const path = normalizeAppPath(pathname)
  const tab = getSearchString(search, 'tab')

  if (path === '/app/library') {
    if (tab === 'borrow') {
      return [{ label: i18n.t('tabs.borrow', { ns: 'archive-warehouse' }) }]
    }
    if (tab === 'reading') {
      return [{ label: i18n.t('tabs.reading', { ns: 'archive-warehouse' }) }]
    }
    if (tab === 'borrowReview') {
      return [
        {
          label: i18n.t('tabs.borrowReview', { ns: 'archive-warehouse' }),
        },
      ]
    }
  }

  if (path === '/app/archive-warehouse' && tab && isArchiveDataHubTab(tab)) {
    const crumbs = [
      { label: i18n.t(`tabs.${tab}`, { ns: 'archive-warehouse' }) },
    ]
    if (tab === 'expiryReview') {
      const disposalView = getSearchString(search, 'disposalView')
      const view = ARCHIVE_DISPOSAL_VIEWS.includes(
        disposalView as (typeof ARCHIVE_DISPOSAL_VIEWS)[number],
      )
        ? disposalView
        : 'list'
      crumbs.push({
        label: i18n.t(
          view === 'proposal'
            ? 'disposal.subTabProposal'
            : 'disposal.subTabList',
          { ns: 'archive-warehouse' },
        ),
      })
    }
    return crumbs
  }

  const mapped = PATH_LEAF_CRUMBS[path]
  if (mapped) {
    return [{ label: i18n.t(mapped.key, { ns: mapped.ns }) }]
  }

  return []
}
