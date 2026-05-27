import { useTranslation } from 'react-i18next'

import logoSrc from '@/assets/images/Lg1.png'
import { cn } from '@/lib/utils/cn'

interface AppLogoProps {
  className?: string
}

export function AppLogo({ className }: AppLogoProps) {
  const { t } = useTranslation('common')

  return (
    <img
      src={logoSrc}
      alt={t('appName')}
      className={cn('h-8 w-auto sm:h-10', className)}
    />
  )
}
