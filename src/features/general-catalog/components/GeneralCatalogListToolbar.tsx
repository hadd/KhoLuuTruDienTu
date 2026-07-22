import { Plus } from 'lucide-react'

import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'

type GeneralCatalogListToolbarProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  searchPlaceholder: string
  createLabel: string
  onCreate: () => void
  canCreate?: boolean
}

export function GeneralCatalogListToolbar({
  searchValue,
  onSearchChange,
  onSearch,
  searchPlaceholder,
  createLabel,
  onCreate,
  canCreate = true,
}: GeneralCatalogListToolbarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ListPageSearchInput
        className="w-full sm:max-w-md"
        value={searchValue}
        onChange={onSearchChange}
        onSearch={onSearch}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      <Button
        type="button"
        className="shrink-0 self-end sm:self-auto"
        onClick={onCreate}
        disabled={!canCreate}
      >
        <Plus className="size-4" />
        {createLabel}
      </Button>
    </div>
  )
}
