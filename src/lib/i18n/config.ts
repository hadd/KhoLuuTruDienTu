import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'

import enArchiveConfig from './locales/en/archive-config.json'
import enArchivePermission from './locales/en/archive-permission.json'
import enArchiveReview from './locales/en/archive-review.json'
import enArchiveSubmission from './locales/en/archive-submission.json'
import enArchiveWarehouse from './locales/en/archive-warehouse.json'
import enArchiveFond from './locales/en/archive-fond.json'
import enRetentionPeriod from './locales/en/retention-period.json'
import enPhysicalWarehouse from './locales/en/physical-warehouse.json'
import enWarehouseManagement from './locales/en/warehouse-management.json'
import enGeneralCatalog from './locales/en/general-catalog.json'
import enInventory from './locales/en/inventory.json'
import enDossierType from './locales/en/dossier-type.json'
import enDocumentType from './locales/en/document-type.json'
import enAdminDashboard from './locales/en/admin-dashboard.json'
import enArchiveFond from './locales/en/archive-fond.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enDataConfig from './locales/en/data-config.json'
import enDataManagement from './locales/en/data-management.json'
import enEditorDashboard from './locales/en/editor-dashboard.json'
import enEditorDossiers from './locales/en/editor-dossiers.json'
import enGroup from './locales/en/group.json'
import enHome from './locales/en/home.json'
import enNotificationConfig from './locales/en/notification-config.json'
import enNotifications from './locales/en/notifications.json'
import enWatermarkConfig from './locales/en/watermark-config.json'
import enDocumentNamingConfig from './locales/en/document-naming-config.json'
import enPermissions from './locales/en/permissions.json'
import enPlanManagement from './locales/en/plan-management.json'
import enProjectManagement from './locales/en/project-management.json'
import enProjectManager from './locales/en/project-manager.json'
import enQcDashboard from './locales/en/qc-dashboard.json'
import enDigitization from './locales/en/digitization.json'
import enScanIntake from './locales/en/scan-intake.json'
import enUser from './locales/en/user.json'
import enUserManagement from './locales/en/user-management.json'
import enSecurityLevel from './locales/en/security-level.json'
import enOcrControl from './locales/en/ocr-control.json'
import viArchiveConfig from './locales/vi/archive-config.json'
import viArchivePermission from './locales/vi/archive-permission.json'
import viArchiveReview from './locales/vi/archive-review.json'
import viArchiveSubmission from './locales/vi/archive-submission.json'
import viArchiveWarehouse from './locales/vi/archive-warehouse.json'
import viArchiveFond from './locales/vi/archive-fond.json'
import viRetentionPeriod from './locales/vi/retention-period.json'
import viPhysicalWarehouse from './locales/vi/physical-warehouse.json'
import viWarehouseManagement from './locales/vi/warehouse-management.json'
import viGeneralCatalog from './locales/vi/general-catalog.json'
import viInventory from './locales/vi/inventory.json'
import viDossierType from './locales/vi/dossier-type.json'
import viDocumentType from './locales/vi/document-type.json'
import viAdminDashboard from './locales/vi/admin-dashboard.json'
import viArchiveFond from './locales/vi/archive-fond.json'
import viAuth from './locales/vi/auth.json'
import viCommon from './locales/vi/common.json'
import viDataConfig from './locales/vi/data-config.json'
import viDataManagement from './locales/vi/data-management.json'
import viEditorDashboard from './locales/vi/editor-dashboard.json'
import viEditorDossiers from './locales/vi/editor-dossiers.json'
import viGroup from './locales/vi/group.json'
import viHome from './locales/vi/home.json'
import viNotificationConfig from './locales/vi/notification-config.json'
import viNotifications from './locales/vi/notifications.json'
import viWatermarkConfig from './locales/vi/watermark-config.json'
import viDocumentNamingConfig from './locales/vi/document-naming-config.json'
import viPermissions from './locales/vi/permissions.json'
import viPlanManagement from './locales/vi/plan-management.json'
import viProjectManagement from './locales/vi/project-management.json'
import viProjectManager from './locales/vi/project-manager.json'
import viQcDashboard from './locales/vi/qc-dashboard.json'
import viDigitization from './locales/vi/digitization.json'
import viScanIntake from './locales/vi/scan-intake.json'
import viUser from './locales/vi/user.json'
import viUserManagement from './locales/vi/user-management.json'
import customViLocale from './zod-locale-vi'
import viSecurityLevel from './locales/vi/security-level.json'
import viOcrControl from './locales/vi/ocr-control.json'

const LANGUAGE_STORAGE_KEY = 'app_language'

function getInitialLanguage(): 'vi' | 'en' {
  if (typeof window === 'undefined') return 'vi'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'vi' || stored === 'en') return stored
  return 'vi'
}

// Function to configure Zod locale based on i18next language
const configureZodLocale = (language: string) => {
  if (language === 'vi') {
    // Use custom Vietnamese locale with improved error messages
    z.config(customViLocale())
  } else {
    z.config(z.locales.en())
  }
}

void i18n.use(initReactI18next).init({
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  fallbackNS: 'common',
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      home: enHome,
      user: enUser,
      'user-management': enUserManagement,
      group: enGroup,
      'admin-dashboard': enAdminDashboard,
      'data-management': enDataManagement,
      'data-config': enDataConfig,
      permissions: enPermissions,
      'qc-dashboard': enQcDashboard,
      'editor-dashboard': enEditorDashboard,
      'editor-dossiers': enEditorDossiers,
      'project-management': enProjectManagement,
      'project-manager': enProjectManager,
      'plan-management': enPlanManagement,
      'archive-fond': enArchiveFond,
      'retention-period': enRetentionPeriod,
      'physical-warehouse': enPhysicalWarehouse,
      inventory: enInventory,
      'dossier-type': enDossierType,
      'document-type': enDocumentType,
      'archive-config': enArchiveConfig,
      'archive-permission': enArchivePermission,
      'archive-review': enArchiveReview,
      'archive-submission': enArchiveSubmission,
      'archive-warehouse': enArchiveWarehouse,
      'warehouse-management': enWarehouseManagement,
      'general-catalog': enGeneralCatalog,
      digitization: enDigitization,
      'scan-intake': enScanIntake,
      'notification-config': enNotificationConfig,
      notifications: enNotifications,
      'watermark-config': enWatermarkConfig,
      'document-naming-config': enDocumentNamingConfig,
      'security-level': enSecurityLevel,
      'ocr-control': enOcrControl,
    },
    vi: {
      common: viCommon,
      auth: viAuth,
      home: viHome,
      user: viUser,
      'user-management': viUserManagement,
      group: viGroup,
      'admin-dashboard': viAdminDashboard,
      'data-management': viDataManagement,
      'data-config': viDataConfig,
      permissions: viPermissions,
      'qc-dashboard': viQcDashboard,
      'editor-dashboard': viEditorDashboard,
      'editor-dossiers': viEditorDossiers,
      'project-management': viProjectManagement,
      'project-manager': viProjectManager,
      'plan-management': viPlanManagement,
      'archive-fond': viArchiveFond,
      'retention-period': viRetentionPeriod,
      'physical-warehouse': viPhysicalWarehouse,
      inventory: viInventory,
      'dossier-type': viDossierType,
      'document-type': viDocumentType,
      'archive-config': viArchiveConfig,
      'archive-permission': viArchivePermission,
      'archive-review': viArchiveReview,
      'archive-submission': viArchiveSubmission,
      'archive-warehouse': viArchiveWarehouse,
      'warehouse-management': viWarehouseManagement,
      'general-catalog': viGeneralCatalog,
      digitization: viDigitization,
      'scan-intake': viScanIntake,
      'notification-config': viNotificationConfig,
      notifications: viNotifications,
      'watermark-config': viWatermarkConfig,
      'document-naming-config': viDocumentNamingConfig,
      'security-level': viSecurityLevel,
      'ocr-control': viOcrControl,
    },
  },
  interpolation: {
    escapeValue: false,
  },
})

// Configure Zod locale based on initial language
configureZodLocale(i18n.language)

// Update Zod locale and persist preference when language changes
i18n.on('languageChanged', (lng) => {
  configureZodLocale(lng)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  }
})

export default i18n