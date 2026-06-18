import 'i18next'

import type enAdminDashboard from '@/lib/i18n/locales/en/admin-dashboard.json'
import type enAuth from '@/lib/i18n/locales/en/auth.json'
import type enCommon from '@/lib/i18n/locales/en/common.json'
import type enDataConfig from '@/lib/i18n/locales/en/data-config.json'
import type enDataManagement from '@/lib/i18n/locales/en/data-management.json'
import type enGroup from '@/lib/i18n/locales/en/group.json'
import type enHome from '@/lib/i18n/locales/en/home.json'
import type enPermissions from '@/lib/i18n/locales/en/permissions.json'
import type enEditorDashboard from '@/lib/i18n/locales/en/editor-dashboard.json'
import type enQcDashboard from '@/lib/i18n/locales/en/qc-dashboard.json'
import type enUser from '@/lib/i18n/locales/en/user.json'
import type enProjectManager from '@/lib/i18n/locales/en/project-manager.json'

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
      'project-manager': typeof enProjectManager
    }
  }
}
