import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { MetadataHiddenFieldsPage } from '@/features/metadata-extract/components/MetadataHiddenFieldsPage'
import { metadataHiddenFieldsQueryOptions } from '@/features/metadata-extract/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data-config/metadata-hidden-fields')({
  staticData: {
    crumb: () => ({
      label: i18n.t('tiles.metadataHiddenFields', { ns: 'data-config' }),
      parent: {
        label: i18n.t('admin.dataConfig.title', { ns: 'common' }),
        to: '/app/data-config',
      },
    }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(
      context,
      APP_SCREEN_ACCESS.dataConfig.metadataHiddenFields,
    )
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      metadataHiddenFieldsQueryOptions(),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('tiles.metadataHiddenFields', { ns: 'data-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: MetadataHiddenFieldsRoute,
  errorComponent: MetadataHiddenFieldsErrorComponent,
})

function MetadataHiddenFieldsRoute() {
  return <MetadataHiddenFieldsPage />
}

function MetadataHiddenFieldsErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        Không thể tải trang cấu hình trường ẩn
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : 'Có lỗi xảy ra'}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
