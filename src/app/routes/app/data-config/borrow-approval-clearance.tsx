import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { BorrowApprovalClearancePage } from '@/features/borrow-approval-clearance/components/BorrowApprovalClearancePage'
import { borrowApprovalClearanceQueryOptions } from '@/features/borrow-approval-clearance/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute(
  '/app/data-config/borrow-approval-clearance',
)({
  staticData: {
    crumb: () => ({
      label: i18n.t('tiles.borrowApprovalClearance', { ns: 'data-config' }),
      parent: {
        label: i18n.t('admin.dataConfig.title', { ns: 'common' }),
        to: '/app/data-config',
      },
    }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(
      context,
      APP_SCREEN_ACCESS.dataConfig.borrowApprovalClearance,
    )
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      borrowApprovalClearanceQueryOptions(),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'borrow-approval-clearance' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: BorrowApprovalClearanceRoute,
  errorComponent: BorrowApprovalClearanceErrorComponent,
})

function BorrowApprovalClearanceRoute() {
  return <BorrowApprovalClearancePage />
}

function BorrowApprovalClearanceErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('borrow-approval-clearance')
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
