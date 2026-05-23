import { FolderUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { RolePermissions } from '@/features/data-management/config/roleConfig'

export function DataManagementToolbar({
  onUploadClick,
  permissions,
}: {
  onUploadClick: () => void
  permissions: RolePermissions
}) {
  const { t } = useTranslation('data-management')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {permissions.canUpload && (
        <Button
          type="button"
          variant="default"
          className="shrink-0 gap-2"
          onClick={onUploadClick}
        >
          <FolderUp className="size-4" aria-hidden />
          {t('actions.uploadFolder')}
        </Button>
      )}
    </div>
  )
}
