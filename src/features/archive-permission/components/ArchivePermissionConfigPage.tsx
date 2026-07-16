import { useTranslation } from 'react-i18next'

import { ArchiveAclMatrixPanel } from '@/features/archive-permission/components/ArchiveAclMatrixPanel'

interface ArchivePermissionConfigPageProps {
  embedded?: boolean
}

export function ArchivePermissionConfigPage({
  embedded = false,
}: ArchivePermissionConfigPageProps) {
  const { t } = useTranslation('archive-permission')

  return (
    <div className="flex w-full flex-col gap-4">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        </div>
      ) : null}

      <ArchiveAclMatrixPanel />
    </div>
  )
}
