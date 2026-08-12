import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { GroupManagementPage } from '@/features/group/components/GroupManagementPage'
import {
  ADMIN_GROUPS_PAGE_SIZE_OPTIONS,
  adminGroupsQueryOptions,
  DEFAULT_ADMIN_GROUPS_LIMIT,
} from '@/features/group/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

const adminGroupsLimitSchema = z.coerce
  .number()
  .int()
  .refine((value) =>
    (ADMIN_GROUPS_PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(value),
  )

const groupsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
  limit: adminGroupsLimitSchema.optional().catch(DEFAULT_ADMIN_GROUPS_LIMIT),
})

export const Route = createFileRoute('/app/groups/')({
  staticData: {
    crumb: () => i18n.t('sectionTabs.groups', { ns: 'project-management' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.groups.module,
    })
  },
  validateSearch: groupsSearchSchema,
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'group' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminGroupsQueryOptions({ page: 1, limit: DEFAULT_ADMIN_GROUPS_LIMIT }),
    )
    return {}
  },
  component: GroupManagementRoute,
  errorComponent: AdminGroupsErrorComponent,
})

function GroupManagementRoute() {
  return <GroupManagementPage />
}

function AdminGroupsErrorComponent({
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
        {t('error')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('error')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
