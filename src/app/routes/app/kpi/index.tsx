import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { RolePlaceholderPage } from '@/features/data-management/components/RolePlaceholderPage'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/kpi/')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.kpi.module,
    })
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('sidebar.items.kpiReport', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: EditorKpiRoute,
  errorComponent: EditorKpiErrorComponent,
})

function EditorKpiErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {tCommon('errors.defaultTitle')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error
          ? translateError(error)
          : tCommon('errors.defaultDescription')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}

function EditorKpiRoute() {
  return <RolePlaceholderPage titleKey="sidebar.items.kpiReport" />
}
