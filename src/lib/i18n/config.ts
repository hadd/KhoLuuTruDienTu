import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'

import enAdminDashboard from './locales/en/admin-dashboard.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enHome from './locales/en/home.json'
import viAdminDashboard from './locales/vi/admin-dashboard.json'
import viAuth from './locales/vi/auth.json'
import viCommon from './locales/vi/common.json'
import viHome from './locales/vi/home.json'
import enDataManagement from './locales/en/data-management.json'
import enUser from './locales/en/user.json'
import viDataManagement from './locales/vi/data-management.json'
import viUser from './locales/vi/user.json'
import customViLocale from './zod-locale-vi'
import enDataConfig from './locales/en/data-config.json'
import enGroup from './locales/en/group.json'
import enPermissions from './locales/en/permissions.json'
import enEditorDashboard from './locales/en/editor-dashboard.json'
import enQcDashboard from './locales/en/qc-dashboard.json'
import viDataConfig from './locales/vi/data-config.json'
import viGroup from './locales/vi/group.json'
import viPermissions from './locales/vi/permissions.json'
import viEditorDashboard from './locales/vi/editor-dashboard.json'
import viQcDashboard from './locales/vi/qc-dashboard.json'
import enProjectManager from './locales/en/project-manager.json'
import viProjectManager from './locales/vi/project-manager.json'
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
      'project-manager': enProjectManager,
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
      'project-manager': viProjectManager,
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
