import { FolderUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DataManagementRole, RolePermissions } from '@/features/data-management/config/roleConfig'

export function DataManagementToolbar({
  searchQuery,
  onSearchChange,
  onUploadClick,
  role,
  permissions,
}: {
  searchQuery: string
  onSearchChange: (raw: string) => void
  onUploadClick: () => void
  role: DataManagementRole
  permissions: RolePermissions
}) {
  const { t } = useTranslation('data-management')
  const showSearch = role !== 'editor'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {showSearch ? (
        <Input
          className="max-w-md border-input bg-background"
          placeholder={t('search.placeholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('search.placeholder')}
        />
      ) : (
        <span aria-hidden />
      )}
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
