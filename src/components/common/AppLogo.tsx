import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import logoSrc from '@/assets/images/Lg1.png'
import { cn } from '@/lib/utils/cn'

interface AppLogoProps {
  className?: string
}

export function AppLogo({ className }: AppLogoProps) {
  const { t } = useTranslation('common')

  return (
    <Link
      to="/app/dashboard"
      className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('admin.dashboard')}
    >
      <img
        src={logoSrc}
        alt={t('appName')}
        className={cn('h-8 w-auto sm:h-10', className)}
      />
    </Link>
  )
}
