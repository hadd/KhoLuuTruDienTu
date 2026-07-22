import 'i18next'
import type enAdminDashboard from '@/lib/i18n/locales/en/admin-dashboard.json'
import type enArchiveFond from '@/lib/i18n/locales/en/archive-fond.json'
import type enArchiveWarehouse from '@/lib/i18n/locales/en/archive-warehouse.json'
import type enWarehouseManagement from '@/lib/i18n/locales/en/warehouse-management.json'
import type enGeneralCatalog from '@/lib/i18n/locales/en/general-catalog.json'
import type enAuth from '@/lib/i18n/locales/en/auth.json'
import type enCommon from '@/lib/i18n/locales/en/common.json'
import type enDataConfig from '@/lib/i18n/locales/en/data-config.json'
import type enDataManagement from '@/lib/i18n/locales/en/data-management.json'
import type enDossierType from '@/lib/i18n/locales/en/dossier-type.json'
import type enEditorDashboard from '@/lib/i18n/locales/en/editor-dashboard.json'
import type enEditorDossiers from '@/lib/i18n/locales/en/editor-dossiers.json'
import type enGroup from '@/lib/i18n/locales/en/group.json'
import type enHome from '@/lib/i18n/locales/en/home.json'
import type enInventory from '@/lib/i18n/locales/en/inventory.json'
import type enNotificationConfig from '@/lib/i18n/locales/en/notification-config.json'
import type enNotifications from '@/lib/i18n/locales/en/notifications.json'
import type enPermissions from '@/lib/i18n/locales/en/permissions.json'
import type enPlanManagement from '@/lib/i18n/locales/en/plan-management.json'
import type enProjectManager from '@/lib/i18n/locales/en/project-manager.json'
import type enQcDashboard from '@/lib/i18n/locales/en/qc-dashboard.json'
import type enRetentionPeriod from '@/lib/i18n/locales/en/retention-period.json'
import type enScanIntake from '@/lib/i18n/locales/en/scan-intake.json'
import type enUser from '@/lib/i18n/locales/en/user.json'
import type enSecurityLevel from '@/lib/i18n/locales/en/security-level.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof enCommon
      auth: typeof enAuth
      home: typeof enHome
      user: typeof enUser
      group: typeof enGroup
      'admin-dashboard': typeof enAdminDashboard
      'data-management': typeof enDataManagement
      'data-config': typeof enDataConfig
      permissions: typeof enPermissions
      'qc-dashboard': typeof enQcDashboard
      'editor-dashboard': typeof enEditorDashboard
      'editor-dossiers': typeof enEditorDossiers
      'project-manager': typeof enProjectManager
      'plan-management': typeof enPlanManagement
      'archive-fond': typeof enArchiveFond
      'archive-warehouse': typeof enArchiveWarehouse
      'warehouse-management': typeof enWarehouseManagement
      'general-catalog': typeof enGeneralCatalog
      'retention-period': typeof enRetentionPeriod
      inventory: typeof enInventory
      'dossier-type': typeof enDossierType
      'security-level': typeof enSecurityLevel
      'scan-intake': typeof enScanIntake
      'notification-config': typeof enNotificationConfig
      notifications: typeof enNotifications
    }
  }
}