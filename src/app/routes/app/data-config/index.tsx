import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { DataConfigHubPage } from '@/features/data-config/components/DataConfigHubPage'
import { isMetadataSidebarChildGranted } from '@/features/navigation/config/sidebarMetadataPermissions'
import { permissionsCatalogQueryOptions } from '@/features/permissions/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data-config/')({
  staticData: {
    crumb: () => i18n.t('admin.dataConfig.title', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const [{ user, permissions }, catalog] = await Promise.all([
      loadPermissionContext(context.queryClient),
      context.queryClient.ensureQueryData(permissionsCatalogQueryOptions()),
    ])
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canAccess =
      isMetadataSidebarChildGranted('document-types', permissions, catalog) ||
      isMetadataSidebarChildGranted(
        'document-assignment',
        permissions,
        catalog,
      ) ||
      isMetadataSidebarChildGranted(
        'metadata-export-presets',
        permissions,
        catalog,
      ) ||
      canAccessScreen(permissions, {
        module: 'roles',
        permissionKey: 'roles.manage',
      }) ||
      canAccessScreen(permissions, {
        module: 'watermark',
        permissionKey: 'watermark.config.read',
      })

    if (!canAccess) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          catalog,
          primaryAppRole,
        ),
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'data-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: DataConfigHubRoute,
  errorComponent: DataConfigHubErrorComponent,
})

function DataConfigHubRoute() {
  return <DataConfigHubPage />
}

function DataConfigHubErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('data-config')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('hub.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('hub.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
