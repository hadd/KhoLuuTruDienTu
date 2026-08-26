import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { AuditLogConfigPage } from '@/features/audit-log-config/components/AuditLogConfigPage'
import { auditLogConfigQueryOptions } from '@/features/audit-log-config/queries'
import { auditLogConfigSearchSchema } from '@/features/audit-log-config/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data-config/audit-log-config')({
  staticData: {
    crumb: () => ({
      label: i18n.t('tiles.auditLogConfig', { ns: 'data-config' }),
      parent: {
        label: i18n.t('admin.dataConfig.title', { ns: 'common' }),
        to: '/app/data-config',
      },
    }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.auditLogConfig)
  },
  validateSearch: (raw) => auditLogConfigSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(auditLogConfigQueryOptions())
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'audit-log-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: AuditLogConfigRoute,
  errorComponent: AuditLogConfigErrorComponent,
})

function AuditLogConfigRoute() {
  return <AuditLogConfigPage />
}

function AuditLogConfigErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('audit-log-config')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
