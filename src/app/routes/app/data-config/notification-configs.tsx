import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requireAppRole } from '@/features/auth/routeGuards'
import { NotificationConfigPage } from '@/features/notification-config/components/NotificationConfigPage'
import { notificationConfigsQueryOptions } from '@/features/notification-config/queries'
import { notificationConfigSearchSchema } from '@/features/notification-config/schemas'
import { adminRolesQueryOptions } from '@/features/user/queries'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/data-config/notification-configs')({
  beforeLoad: async ({ context }) => {
    await requireAppRole(context, 'admin')
  },
  validateSearch: (raw) => notificationConfigSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(notificationConfigsQueryOptions()),
      context.queryClient.ensureQueryData(adminRolesQueryOptions()),
    ])
    return {}
  },
  staticData: {
    crumb: () =>
      i18n.t('pageTitles.notificationConfigs', {
        ns: 'notification-config',
      }),
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.notificationConfigs', { ns: 'notification-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: NotificationConfigRoute,
  errorComponent: NotificationConfigErrorComponent,
})

function NotificationConfigRoute() {
  return <NotificationConfigPage />
}

function NotificationConfigErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('notification-config')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
      <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        {t('actions.retry')}
      </button>
    </div>
  )
}

