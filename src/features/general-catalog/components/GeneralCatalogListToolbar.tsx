import { Plus } from 'lucide-react'

import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type GeneralCatalogListToolbarProps = {
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearch?: () => void
  searchPlaceholder?: string
  createLabel?: string
  onCreate?: () => void
  canCreate?: boolean
  showSearch?: boolean
}

export function GeneralCatalogListToolbar({
  searchValue,
  onSearchChange,
  onSearch,
  searchPlaceholder,
  createLabel,
  onCreate,
  canCreate = true,
  showSearch = true,
}: GeneralCatalogListToolbarProps) {
  const shouldRenderSearch =
    showSearch && Boolean(onSearchChange && onSearch && searchPlaceholder)
  const shouldRenderCreate = Boolean(onCreate && createLabel)

  if (!shouldRenderSearch && !shouldRenderCreate) {
    return null
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center',
        shouldRenderSearch ? 'sm:justify-between' : 'sm:justify-end',
      )}
    >
      {shouldRenderSearch ? (
        <ListPageSearchInput
          className="w-full sm:max-w-md"
          value={searchValue ?? ''}
          onChange={onSearchChange!}
          onSearch={onSearch!}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      ) : null}
      {shouldRenderCreate ? (
        <Button
          type="button"
          className="shrink-0 self-end sm:self-auto"
          onClick={onCreate}
          disabled={!canCreate}
        >
          <Plus className="size-4" />
          {createLabel}
        </Button>
      ) : null}
    </div>
  )
}
