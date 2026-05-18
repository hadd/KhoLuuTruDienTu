import { FolderUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function DataManagementToolbar({
  searchQuery,
  onSearchChange,
  onUploadClick,
}: {
  searchQuery: string
  onSearchChange: (raw: string) => void
  onUploadClick: () => void
}) {
  const { t } = useTranslation('data-management')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
        className="max-w-md border-input bg-background"
        placeholder={t('search.placeholder')}
        defaultValue={searchQuery}
        key={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label={t('search.placeholder')}
      />
      <Button type="button" variant="default" className="shrink-0 gap-2" onClick={onUploadClick}>
        <FolderUp className="size-4" aria-hidden />
        {t('actions.uploadFolder')}
      </Button>
    </div>
  )
}
