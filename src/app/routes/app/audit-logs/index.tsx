import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { AuditLogListPage } from '@/features/audit-log/components/AuditLogListPage'
import { auditLogsQueryOptions } from '@/features/audit-log/queries'
import { auditLogSearchSchema } from '@/features/audit-log/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/audit-logs/')({
  staticData: {
    crumb: () => i18n.t('admin.auditLogs', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.auditLogs)
  },
  validateSearch: (raw) => auditLogSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      auditLogsQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'audit-log' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: AuditLogRoute,
  errorComponent: AuditLogErrorComponent,
})

function AuditLogRoute() {
  return <AuditLogListPage />
}

function AuditLogErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('audit-log')
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
