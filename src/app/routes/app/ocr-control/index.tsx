import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { OcrControlPage } from '@/features/ocr-control/components/OcrControlPage'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/ocr-control/')({
  staticData: {
    crumb: () => i18n.t('sectionTabs.ocrControl', { ns: 'digitization' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [...APP_SCREEN_ACCESS.ocrControl.requirements])
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'ocr-control' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: OcrControlRoute,
  errorComponent: OcrControlErrorComponent,
})

function OcrControlRoute() {
  return <OcrControlPage />
}

function OcrControlErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('ocr-control')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {tCommon('errors.defaultTitle')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('title')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
