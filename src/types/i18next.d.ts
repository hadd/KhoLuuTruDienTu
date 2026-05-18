import 'i18next'

import type enAuth from '@/lib/i18n/locales/en/auth.json'
import type enCommon from '@/lib/i18n/locales/en/common.json'
import type enDataManagement from '@/lib/i18n/locales/en/data-management.json'
import type enHome from '@/lib/i18n/locales/en/home.json'
import type enUser from '@/lib/i18n/locales/en/user.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof enCommon
      auth: typeof enAuth
      home: typeof enHome
      user: typeof enUser
      'data-management': typeof enDataManagement
    }
  }
}
