import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import logoSrc from '@/assets/images/vn-emblem.svg'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { APP_HOME_PATH } from '@/features/auth/constants'
import { useAuthStore } from '@/features/auth/store'
import i18n from '@/lib/i18n/config'

const benefits = [
  'reduceLaborCost',
  'accelerateDataEntry',
  'optimizeOperations',
  'dataAccuracy',
] as const

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.login', { ns: 'auth' })} - ${i18n.t('pageTitles.appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const roles = useAuthStore((state) => state.roles)

  useEffect(() => {
    if (!accessToken) {
      return
    }

    if (roles.length > 0) {
      navigate({ to: APP_HOME_PATH })
    }
  }, [accessToken, navigate, roles])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 md:flex-row">
      <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row min-h-0">
        {/* Left Section - Branding */}
        <section className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-8 lg:py-12 xl:px-12 min-h-0">
          <div className="space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
            {/* Logo Section - 2 dòng */}
            <div className="space-y-2 sm:space-y-3">
              {/* Dòng 1: Logo và tên */}
              <div className="flex items-center">
                <img
                  src={logoSrc}
                  alt={t('badge')}
                  className="h-10 w-auto sm:h-12 md:h-14 lg:h-16"
                />
              </div>
              {/* Dòng 2: Tagline */}
              <p className="hidden md:block text-sm text-muted-foreground">
                {t('subtitle')}
              </p>
            </div>

            {/* Main Headline */}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-foreground">
              {t('title')}
            </h1>

            {/* Features Badge */}
            <div className="hidden lg:block">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
                {t('featuresBadge')}
              </p>
            </div>

            {/* Features List */}
            <ul className="hidden lg:block space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-base text-muted-foreground">
                    {t(`benefits.${benefit}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Section - Login Form */}
        <section className="flex flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-8 lg:py-12 xl:px-12 min-h-0">
          <div className="w-full max-w-md rounded-xl bg-white p-4 sm:p-6 md:p-6 lg:p-8 shadow-lg">
            <div className="space-y-2 text-center">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                {t('loginTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('loginSubtitle')}
              </p>
            </div>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
