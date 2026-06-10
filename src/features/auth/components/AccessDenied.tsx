import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { APP_HOME_PATH } from '@/features/auth/constants'

export function AccessDenied() {
  const { t } = useTranslation('common')
  const router = useRouter()

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.history.back()
      return
    }
    handleGoHome()
  }

  const handleGoHome = () => {
    void router.navigate({ to: APP_HOME_PATH })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          {t('accessDenied.title')}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {t('accessDenied.description')}
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleGoBack} variant="default">
            <ArrowLeft className="mr-2 size-4" />
            {t('accessDenied.goBack')}
          </Button>
          <Button onClick={handleGoHome} variant="outline">
            <Home className="mr-2 size-4" />
            {t('accessDenied.goHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
