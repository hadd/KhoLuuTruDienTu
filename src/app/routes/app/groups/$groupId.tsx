import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { permissionTemplateOptionsQueryOptions } from '@/features/data-config/queries'
import { GroupDetailPage } from '@/features/group/components/GroupDetailPage'
import {
  groupDetailQueryOptions,
  metadataPermissionConfigsQueryOptions,
} from '@/features/group/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/groups/$groupId')({
  staticData: {
    crumb: () => i18n.t('detail.title', { ns: 'group' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.groups.module,
    })
  },
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        groupDetailQueryOptions(params.groupId),
      ),
      context.queryClient.ensureQueryData(
        metadataPermissionConfigsQueryOptions(),
      ),
      context.queryClient.ensureQueryData(
        permissionTemplateOptionsQueryOptions(),
      ),
    ])
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('detail.title', { ns: 'group' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: GroupDetailRoute,
  errorComponent: GroupDetailErrorComponent,
})

function GroupDetailRoute() {
  return <GroupDetailPage />
}

function GroupDetailErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('group')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('detailError')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('detailError')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
