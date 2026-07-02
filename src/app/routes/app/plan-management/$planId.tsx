import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { PlanDetailPage } from '@/features/plan-management/components/PlanDetailPage'
import {
  projectPlanDetailsQueryOptions,
  projectPlanQueryOptions,
} from '@/features/plan-management/queries'
import { planSearchSchema } from '@/features/plan-management/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/plan-management/$planId')({
  staticData: {
    crumb: () => i18n.t('detail.title', { ns: 'plan-management' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.planManagement.module,
    })
  },
  validateSearch: (raw) => planSearchSchema.parse(raw),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        projectPlanQueryOptions(params.planId),
      ),
      context.queryClient.ensureQueryData(
        projectPlanDetailsQueryOptions(params.planId),
      ),
    ])
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('detail.title', { ns: 'plan-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: PlanDetailRoute,
  errorComponent: PlanDetailErrorComponent,
})

function PlanDetailRoute() {
  return <PlanDetailPage />
}

function PlanDetailErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('plan-management')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.detailFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error
          ? translateError(error)
          : t('errors.detailFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
