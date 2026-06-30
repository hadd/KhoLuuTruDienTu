import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'

import enArchiveFond from './locales/en/archive-fond.json'
import enAdminDashboard from './locales/en/admin-dashboard.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enDataConfig from './locales/en/data-config.json'
import enDataManagement from './locales/en/data-management.json'
import enDocumentScan from './locales/en/document-scan.json'
import enEditorDashboard from './locales/en/editor-dashboard.json'
import enEditorDossiers from './locales/en/editor-dossiers.json'
import enGroup from './locales/en/group.json'
import enHome from './locales/en/home.json'
import enPermissions from './locales/en/permissions.json'
import enPlanManagement from './locales/en/plan-management.json'
import enProjectManager from './locales/en/project-manager.json'
import enQcDashboard from './locales/en/qc-dashboard.json'
import enUser from './locales/en/user.json'
import viArchiveFond from './locales/vi/archive-fond.json'
import viAdminDashboard from './locales/vi/admin-dashboard.json'
import viAuth from './locales/vi/auth.json'
import viCommon from './locales/vi/common.json'
import viDataConfig from './locales/vi/data-config.json'
import viDataManagement from './locales/vi/data-management.json'
import viDocumentScan from './locales/vi/document-scan.json'
import viEditorDashboard from './locales/vi/editor-dashboard.json'
import viEditorDossiers from './locales/vi/editor-dossiers.json'
import viGroup from './locales/vi/group.json'
import viHome from './locales/vi/home.json'
import viPermissions from './locales/vi/permissions.json'
import viPlanManagement from './locales/vi/plan-management.json'
import viProjectManager from './locales/vi/project-manager.json'
import viQcDashboard from './locales/vi/qc-dashboard.json'
import viUser from './locales/vi/user.json'
import customViLocale from './zod-locale-vi'
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
      group: enGroup,
      'admin-dashboard': enAdminDashboard,
      'data-management': enDataManagement,
      'data-config': enDataConfig,
      permissions: enPermissions,
      'qc-dashboard': enQcDashboard,
      'editor-dashboard': enEditorDashboard,
      'editor-dossiers': enEditorDossiers,
      'project-manager': enProjectManager,
      'plan-management': enPlanManagement,
      'document-scan': enDocumentScan,
      'archive-fond': enArchiveFond,
    },
    vi: {
      common: viCommon,
      auth: viAuth,
      home: viHome,
      user: viUser,
      group: viGroup,
      'admin-dashboard': viAdminDashboard,
      'data-management': viDataManagement,
      'data-config': viDataConfig,
      permissions: viPermissions,
      'qc-dashboard': viQcDashboard,
      'editor-dashboard': viEditorDashboard,
      'editor-dossiers': viEditorDossiers,
      'project-manager': viProjectManager,
      'plan-management': viPlanManagement,
      'document-scan': viDocumentScan,
      'archive-fond': viArchiveFond,
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
