import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ArchiveAclMatrixPanel } from '@/features/archive-permission/components/ArchiveAclMatrixPanel'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'

export function ArchivePermissionConfigPage() {
  const { t } = useTranslation('archive-permission')

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{t('banner.title')}</p>
        <p className="mt-1 text-muted-foreground">{t('banner.description')}</p>
        <Link
          to={APP_SCREEN_ACCESS.permissions.to}
          className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
        >
          {t('banner.functionMatrix')}
        </Link>
      </div>

      <ArchiveAclMatrixPanel />
    </div>
  )
}
