import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { ProjectManagerPage } from '@/features/project-manager/components/ProjectManagerPage'
import {
  DEFAULT_PROJECTS_LIMIT,
  projectsQueryOptions,
} from '@/features/project-manager/queries'
import { projectSearchSchema } from '@/features/project-manager/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/project-manager/')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.projectManager)
  },
  validateSearch: (raw) => projectSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      projectsQueryOptions({ limit: DEFAULT_PROJECTS_LIMIT, offset: 0 }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'project-manager' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ProjectManagerRoute,
  errorComponent: ProjectManagerErrorComponent,
})

function ProjectManagerRoute() {
  return <ProjectManagerPage />
}

function ProjectManagerErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('project-manager')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error
          ? translateError(error)
          : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
