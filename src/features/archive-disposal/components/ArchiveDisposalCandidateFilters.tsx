import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateRangePicker } from '@/components/common/date/DateRangePicker'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PhysicalWarehouseFilterSelect } from '@/features/archive-disposal/components/PhysicalWarehouseFilterSelect'
import { countDisposalCandidateFilters } from '@/features/archive-disposal/lib/disposalCandidateParams'
import type { DisposalCandidateCategoryT } from '@/features/archive-disposal/types'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseFondsQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { activeRetentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { cn } from '@/lib/utils/cn'

const CATEGORY_OPTIONS: Array<DisposalCandidateCategoryT> = [
  'all',
  'expiring_soon',
  'expired',
  'duplicate',
]

const ALL_VALUE = 'ALL'

type DisposalFilterDraft = {
  disposalCategory?: DisposalCandidateCategoryT
  searchFondId?: string
  dossierTypeId?: string
  documentTypeId?: string
  disposalRetentionPeriodId?: string
  physicalItemId?: string
  disposalDateFrom?: string
  disposalDateTo?: string
}

type ArchiveDisposalCandidateFiltersProps = {
  search: ArchiveDataHubSearchT
  inputValue: string
  onInputValueChange: (value: string) => void
  onSubmitSearch: () => void
  onNavigate: (patch: Partial<ArchiveDataHubSearchT>) => void
  onClearFilters: () => void
  searchPlaceholder?: string
  trailing?: React.ReactNode
}

function toDraft(search: ArchiveDataHubSearchT): DisposalFilterDraft {
  return {
    disposalCategory:
      (search.disposalCategory as DisposalCandidateCategoryT | undefined) ?? 'all',
    searchFondId: search.searchFondId,
    dossierTypeId: search.dossierTypeId,
    documentTypeId: search.documentTypeId,
    disposalRetentionPeriodId: search.disposalRetentionPeriodId,
    physicalItemId: search.physicalItemId,
    disposalDateFrom: search.disposalDateFrom,
    disposalDateTo: search.disposalDateTo,
  }
}

function FilterField({
  id,
  label,
  children,
  className,
}: {
  id?: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function ArchiveDisposalCandidateFilters({
  search,
  inputValue,
  onInputValueChange,
  onSubmitSearch,
  onNavigate,
  onClearFilters,
  searchPlaceholder,
  trailing,
}: ArchiveDisposalCandidateFiltersProps) {
  const { t } = useTranslation('archive-disposal')
  const { t: tRetention } = useTranslation('retention-period')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DisposalFilterDraft>(() => toDraft(search))

  const { data: fondsData } = useQuery(archiveWarehouseFondsQueryOptions())
  const { data: dossierTypesData } = useQuery(archiveWarehouseDossierTypesQueryOptions())
  const { data: documentTypesData } = useQuery(archiveWarehouseDocumentTypesQueryOptions())
  const { data: retentionPeriodsData } = useQuery(activeRetentionPeriodsQueryOptions())

  const activeFilterCount = useMemo(
    () => countDisposalCandidateFilters(search),
    [search],
  )

  useEffect(() => {
    setDraft(toDraft(search))
  }, [search])

  function patchDraft(patch: Partial<DisposalFilterDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function handleApply() {
    onNavigate({
      disposalCategory: draft.disposalCategory ?? 'all',
      searchFondId: draft.searchFondId,
      dossierTypeId: draft.dossierTypeId,
      documentTypeId: draft.documentTypeId,
      disposalRetentionPeriodId: draft.disposalRetentionPeriodId,
      physicalItemId: draft.physicalItemId,
      disposalDateFrom: draft.disposalDateFrom,
      disposalDateTo: draft.disposalDateTo,
      q: inputValue.trim() || undefined,
      page: 1,
    })
    setOpen(false)
  }

  function handleClear() {
    setDraft({ disposalCategory: 'all' })
    onClearFilters()
    setOpen(false)
  }

  return (
    <>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <div className="flex min-w-0 w-full items-center gap-1.5 sm:w-1/2">
          <ListPageSearchInput
            className="min-w-0 max-w-none flex-1"
            value={inputValue}
            onChange={onInputValueChange}
            onSearch={onSubmitSearch}
            placeholder={searchPlaceholder ?? t('disposal.searchPlaceholder')}
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            className="shrink-0 gap-1.5 px-2.5 sm:px-3"
            onClick={() => setOpen(true)}
            aria-label={t('disposal.filters.open')}
          >
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">{t('disposal.filters.open')}</span>
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>

        {trailing ? (
          <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            {trailing}
          </div>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
          ariaTitle={t('disposal.filters.title')}
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{t('disposal.filters.title')}</SheetTitle>
          </SheetHeader>

          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <FilterField id="disposal-filter-category" label={t('disposal.filters.category')}>
                <Select
                  value={draft.disposalCategory ?? 'all'}
                  onValueChange={(value) =>
                    patchDraft({
                      disposalCategory: value as DisposalCandidateCategoryT,
                    })
                  }
                >
                  <SelectTrigger id="disposal-filter-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`disposal.category.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField id="disposal-filter-fond" label={t('disposal.filters.fond')}>
                <Select
                  value={draft.searchFondId ?? ALL_VALUE}
                  onValueChange={(value) =>
                    patchDraft({
                      searchFondId: value === ALL_VALUE ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="disposal-filter-fond" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('disposal.filters.allFonds')}</SelectItem>
                    {(fondsData?.items ?? []).map((fond) => (
                      <SelectItem key={fond.id} value={fond.id}>
                        {fond.fondName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField
                id="disposal-filter-dossier-type"
                label={t('disposal.filters.dossierType')}
              >
                <Select
                  value={draft.dossierTypeId ?? ALL_VALUE}
                  onValueChange={(value) =>
                    patchDraft({
                      dossierTypeId: value === ALL_VALUE ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="disposal-filter-dossier-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>
                      {t('disposal.filters.allDossierTypes')}
                    </SelectItem>
                    {(dossierTypesData?.items ?? []).map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField
                id="disposal-filter-document-type"
                label={t('disposal.filters.documentType')}
              >
                <Select
                  value={draft.documentTypeId ?? ALL_VALUE}
                  onValueChange={(value) =>
                    patchDraft({
                      documentTypeId: value === ALL_VALUE ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="disposal-filter-document-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>
                      {t('disposal.filters.allDocumentTypes')}
                    </SelectItem>
                    {(documentTypesData?.items ?? []).map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField
                id="disposal-filter-retention"
                label={t('disposal.filters.retention')}
              >
                <Select
                  value={draft.disposalRetentionPeriodId ?? ALL_VALUE}
                  onValueChange={(value) =>
                    patchDraft({
                      disposalRetentionPeriodId: value === ALL_VALUE ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="disposal-filter-retention" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>
                      {t('disposal.filters.allRetentionPeriods')}
                    </SelectItem>
                    {(retentionPeriodsData?.items ?? []).map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {formatRetentionDurationLabel(period, tRetention)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <div className="col-span-2">
                <PhysicalWarehouseFilterSelect
                  layout="grid"
                  value={draft.physicalItemId}
                  onValueChange={(physicalItemId) =>
                    patchDraft({ physicalItemId })
                  }
                />
              </div>

              <div className="col-span-2">
                <DateRangePicker
                  label={t('disposal.filters.dateRange')}
                  value={{
                    from: draft.disposalDateFrom,
                    to: draft.disposalDateTo,
                  }}
                  onChange={(range) =>
                    patchDraft({
                      disposalDateFrom: range.from,
                      disposalDateTo: range.to,
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <SheetFooter
            className={cn(
              'mt-auto flex-row gap-2 border-t bg-background px-6 py-4 sm:justify-end sm:space-x-0',
            )}
          >
            <Button type="button" variant="ghost" onClick={handleClear}>
              {t('disposal.filters.clear')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('disposal.filters.apply')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
