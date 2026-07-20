import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import type {ReactNode} from 'react';
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateRangePicker } from '@/components/common/date/DateRangePicker'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
import { cn } from '@/lib/utils/cn'

const ALL_VALUE = 'ALL'
const ALL_YEARS = 'ALL'

export type ArchiveWarehouseFilterValues = {
  q?: string
  searchFondId?: string
  dossierTypeId?: string
  documentTypeId?: string
  editorName?: string
  editCompletedAtFrom?: string
  editCompletedAtTo?: string
  archivedAtFrom?: string
  archivedAtTo?: string
}

type FilterDraft = Omit<ArchiveWarehouseFilterValues, 'q'>

export type WarehouseListBrowseFilters = {
  year?: number
  status: WarehouseDossierStatusT
  availableYears: Array<number>
  disableYear?: boolean
}

type ArchiveWarehouseSearchFiltersProps = {
  values: ArchiveWarehouseFilterValues
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSubmitSearch: () => void
  onChange: (patch: Partial<ArchiveWarehouseFilterValues>) => void
  onClear: () => void
  fonds?: Array<ArchiveFondT>
  /** When set, fond filter is locked to this fond (hidden). */
  lockedFondId?: string
  searchPlaceholder?: string
  /** Year/status filters shown inside the sheet (fond dossier list page). */
  listBrowseFilters?: WarehouseListBrowseFilters
  onListBrowseFiltersChange?: (patch: {
    year?: number
    status?: WarehouseDossierStatusT
  }) => void
  /** Actions aligned to the right on the same row as search (e.g. export). */
  trailing?: ReactNode
}

function toDraft(values: ArchiveWarehouseFilterValues): FilterDraft {
  return {
    searchFondId: values.searchFondId,
    dossierTypeId: values.dossierTypeId,
    documentTypeId: values.documentTypeId,
    editorName: values.editorName,
    editCompletedAtFrom: values.editCompletedAtFrom,
    editCompletedAtTo: values.editCompletedAtTo,
    archivedAtFrom: values.archivedAtFrom,
    archivedAtTo: values.archivedAtTo,
  }
}

function countActiveFilters(
  values: ArchiveWarehouseFilterValues,
  listBrowseFilters?: WarehouseListBrowseFilters,
): number {
  let count = 0
  if (values.searchFondId) count += 1
  if (values.dossierTypeId) count += 1
  if (values.documentTypeId) count += 1
  if (values.editorName?.trim()) count += 1
  if (values.editCompletedAtFrom || values.editCompletedAtTo) count += 1
  if (values.archivedAtFrom || values.archivedAtTo) count += 1
  if (listBrowseFilters?.year != null) count += 1
  return count
}

export function ArchiveWarehouseSearchFilters({
  values,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  onChange,
  onClear,
  fonds = [],
  lockedFondId,
  searchPlaceholder,
  listBrowseFilters,
  onListBrowseFiltersChange,
  trailing,
}: ArchiveWarehouseSearchFiltersProps) {
  const { t } = useTranslation('archive-warehouse')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(values))
  const [listDraft, setListDraft] = useState<{
    year?: number
    status: WarehouseDossierStatusT
  }>(() => ({
    year: listBrowseFilters?.year,
    status: listBrowseFilters?.status ?? 'ARCHIVED',
  }))

  const dossierTypesQuery = useQuery(archiveWarehouseDossierTypesQueryOptions())
  const documentTypesQuery = useQuery(archiveWarehouseDocumentTypesQueryOptions())

  const dossierTypes = dossierTypesQuery.data?.items ?? []
  const documentTypes = documentTypesQuery.data?.items ?? []

  const activeFilterCount = useMemo(
    () => countActiveFilters(values, listBrowseFilters),
    [values, listBrowseFilters],
  )

  useEffect(() => {
    setDraft(toDraft(values))
  }, [values])

  useEffect(() => {
    if (!listBrowseFilters) return
    setListDraft({
      year: listBrowseFilters.year,
      status: listBrowseFilters.status,
    })
  }, [listBrowseFilters?.year, listBrowseFilters?.status, listBrowseFilters])

  function patchDraft(patch: Partial<FilterDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function handleApply() {
    onChange({
      searchFondId: draft.searchFondId,
      dossierTypeId: draft.dossierTypeId,
      documentTypeId: draft.documentTypeId,
      editorName: draft.editorName?.trim() || undefined,
      editCompletedAtFrom: draft.editCompletedAtFrom,
      editCompletedAtTo: draft.editCompletedAtTo,
      archivedAtFrom: draft.archivedAtFrom,
      archivedAtTo: draft.archivedAtTo,
      q: searchInput.trim() || undefined,
    })
    if (listBrowseFilters && onListBrowseFiltersChange) {
      onListBrowseFiltersChange({
        year: listDraft.year,
        status: listDraft.status,
      })
    }
    setOpen(false)
  }

  function handleClear() {
    setDraft({})
    setListDraft({
      year: undefined,
      status: listBrowseFilters?.status ?? 'ARCHIVED',
    })
    onClear()
    setOpen(false)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-1/2">
          <ListPageSearchInput
            className="min-w-0 max-w-none flex-1"
            value={searchInput}
            onChange={onSearchInputChange}
            onSearch={onSubmitSearch}
            placeholder={
              searchPlaceholder ??
              (lockedFondId
                ? t('page.searchPlaceholder')
                : t('page.crossFondSearchPlaceholder'))
            }
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            className="shrink-0 gap-1.5 px-3"
            onClick={() => setOpen(true)}
            aria-label={t('filters.open')}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t('filters.open')}</span>
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
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          ariaTitle={t('filters.title')}
        >
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle>{t('filters.title')}</SheetTitle>
            <SheetDescription>{t('filters.andHint')}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {!lockedFondId ? (
              <div className="space-y-2">
                <Label htmlFor="warehouse-filter-fond">{t('filters.fond')}</Label>
                <Select
                  value={draft.searchFondId ?? ALL_VALUE}
                  onValueChange={(next) =>
                    patchDraft({
                      searchFondId: next === ALL_VALUE ? undefined : next,
                    })
                  }
                >
                  <SelectTrigger id="warehouse-filter-fond" className="w-full">
                    <SelectValue placeholder={t('filters.fond')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filters.allFonds')}</SelectItem>
                    {fonds.map((fond) => (
                      <SelectItem key={fond.id} value={fond.id}>
                        {fond.fondName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {listBrowseFilters ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-filter-year">{t('filters.year')}</Label>
                  <Select
                    value={
                      listDraft.year != null ? String(listDraft.year) : ALL_YEARS
                    }
                    onValueChange={(next) =>
                      setListDraft((prev) => ({
                        ...prev,
                        year: next === ALL_YEARS ? undefined : Number(next),
                      }))
                    }
                    disabled={listBrowseFilters.disableYear}
                  >
                    <SelectTrigger id="warehouse-filter-year" className="w-full">
                      <SelectValue placeholder={t('filters.year')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_YEARS}>{t('filters.allYears')}</SelectItem>
                      {listBrowseFilters.availableYears.map((itemYear) => (
                        <SelectItem key={itemYear} value={String(itemYear)}>
                          {itemYear}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="warehouse-filter-dossier-type">
                {t('filters.dossierType')}
              </Label>
              <Select
                value={draft.dossierTypeId ?? ALL_VALUE}
                onValueChange={(next) =>
                  patchDraft({
                    dossierTypeId: next === ALL_VALUE ? undefined : next,
                  })
                }
              >
                <SelectTrigger id="warehouse-filter-dossier-type" className="w-full">
                  <SelectValue placeholder={t('filters.dossierType')} />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value={ALL_VALUE}>
                    {t('filters.allDossierTypes')}
                  </SelectItem>
                  {dossierTypes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-filter-document-type">
                {t('filters.documentType')}
              </Label>
              <Select
                value={draft.documentTypeId ?? ALL_VALUE}
                onValueChange={(next) =>
                  patchDraft({
                    documentTypeId: next === ALL_VALUE ? undefined : next,
                  })
                }
              >
                <SelectTrigger id="warehouse-filter-document-type" className="w-full">
                  <SelectValue placeholder={t('filters.documentType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t('filters.allDocumentTypes')}
                  </SelectItem>
                  {documentTypes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-filter-editor">{t('filters.editorName')}</Label>
              <Input
                id="warehouse-filter-editor"
                value={draft.editorName ?? ''}
                onChange={(event) =>
                  patchDraft({
                    editorName: event.target.value,
                  })
                }
                placeholder={t('filters.editorNamePlaceholder')}
              />
            </div>

            <DateRangePicker
              label={t('filters.editCompleted')}
              value={{
                from: draft.editCompletedAtFrom,
                to: draft.editCompletedAtTo,
              }}
              onChange={(range) =>
                patchDraft({
                  editCompletedAtFrom: range.from,
                  editCompletedAtTo: range.to,
                })
              }
              className="w-full"
            />

            <DateRangePicker
              label={t('filters.archived')}
              value={{
                from: draft.archivedAtFrom,
                to: draft.archivedAtTo,
              }}
              onChange={(range) =>
                patchDraft({
                  archivedAtFrom: range.from,
                  archivedAtTo: range.to,
                })
              }
              className="w-full"
            />
          </div>

          <SheetFooter
            className={cn(
              'mt-auto flex-row gap-2 border-t bg-background px-6 py-4 sm:justify-end sm:space-x-0',
            )}
          >
            <Button type="button" variant="ghost" onClick={handleClear}>
              {t('filters.clear')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('filters.apply')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function hasWarehouseFilterCriteria(
  values: ArchiveWarehouseFilterValues,
): boolean {
  return Boolean(
    values.q?.trim() ||
    values.searchFondId ||
    values.dossierTypeId ||
    values.documentTypeId ||
    values.editorName?.trim() ||
    values.editCompletedAtFrom ||
    values.editCompletedAtTo ||
    values.archivedAtFrom ||
    values.archivedAtTo,
  )
}

/** True when only a fond is selected — browse DB list instead of ES search. */
export function isFondOnlyWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  return Boolean(
    values.searchFondId &&
    !values.q?.trim() &&
    !values.dossierTypeId &&
    !values.documentTypeId &&
    !values.editorName?.trim() &&
    !values.editCompletedAtFrom &&
    !values.editCompletedAtTo &&
    !values.archivedAtFrom &&
    !values.archivedAtTo,
  )
}

export function buildWarehouseSearchApiParams(
  values: ArchiveWarehouseFilterValues,
  opts: {
    page: number
    limit: number
    lockedFondId?: string
  },
) {
  const q = values.q?.trim()
  const fondId =
    opts.lockedFondId ||
    (values.searchFondId && values.searchFondId !== ALL_VALUE
      ? values.searchFondId
      : undefined)

  const mode = q ? ('content' as const) : ('metadata' as const)

  return {
    mode,
    q: q || undefined,
    fondId,
    dossierTypeId: values.dossierTypeId,
    documentTypeId: values.documentTypeId,
    editorName: values.editorName?.trim() || undefined,
    editCompletedAtFrom: values.editCompletedAtFrom,
    editCompletedAtTo: values.editCompletedAtTo,
    archivedAtFrom: values.archivedAtFrom,
    archivedAtTo: values.archivedAtTo,
    limit: opts.limit,
    offset: (opts.page - 1) * opts.limit,
  }
}
