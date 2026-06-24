import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { adminProjectStore } from '@/features/data-management/store'
import { PlanManagementPage } from '@/features/plan-management/components/PlanManagementPage'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import {
  DEFAULT_PLANS_LIMIT,
  projectPlansQueryOptions,
} from '@/features/plan-management/queries'
import { planSearchSchema } from '@/features/plan-management/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/plan-management/')({
  staticData: {
    crumb: () => i18n.t('admin.planManagement', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.planManagement.module,
    })
  },
  validateSearch: (raw) => planSearchSchema.parse(raw),
  loader: async ({ context, location }) => {
    const search = planSearchSchema.parse(location.search)
    const projectCode =
      search.projectCode?.trim() ||
      adminProjectStore.getState().projectCode ||
      undefined

    if (projectCode) {
      await context.queryClient.ensureQueryData(
        projectPlansQueryOptions({
          projectCode,
          limit: search.limit ?? DEFAULT_PLANS_LIMIT,
          offset: search.offset ?? 0,
        }),
      )
    }

    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'plan-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: PlanManagementRoute,
  errorComponent: PlanManagementErrorComponent,
})

function PlanManagementRoute() {
  return <PlanManagementPage />
}

function PlanManagementErrorComponent({
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
