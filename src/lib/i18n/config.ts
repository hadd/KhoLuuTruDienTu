import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'

import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enHome from './locales/en/home.json'
import viAuth from './locales/vi/auth.json'
import viCommon from './locales/vi/common.json'
import viHome from './locales/vi/home.json'
import enDataManagement from './locales/en/data-management.json'
import enUser from './locales/en/user.json'
import viDataManagement from './locales/vi/data-management.json'
import viUser from './locales/vi/user.json'
import customViLocale from './zod-locale-vi'
import { en } from 'zod/v4/locales'

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
  lng: 'vi',
  fallbackLng: 'en',
  defaultNS: 'common',
  fallbackNS: 'common',
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      home: enHome,
      user: enUser,
      'data-management': enDataManagement,
    },
    vi: {
      common: viCommon,
      auth: viAuth,
      home: viHome,
      user: viUser,
      'data-management': viDataManagement,
    },
  },
  interpolation: {
    escapeValue: false,
  },
})

// Configure Zod locale based on initial language
configureZodLocale(i18n.language)

// Update Zod locale when i18next language changes
i18n.on('languageChanged', (lng) => {
  configureZodLocale(lng)
})

export default i18n
