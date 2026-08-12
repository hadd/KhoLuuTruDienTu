import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/components/common/date/DatePicker'
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import type {
  ArchiveWarehouseFondListItemT,
  WarehouseDossierStatusT,
} from '@/features/archive-warehouse/types'
import { cn } from '@/lib/utils/cn'
import { Checkbox } from '@/components/ui/checkbox'


const ALL_VALUE = 'ALL'
const ALL_YEARS = 'ALL'

export type ArchiveWarehouseFilterValues = {
  q?: string
  searchFondId?: string | string[]
  dossierTypeId?: string | string[]
  documentTypeId?: string | string[]
  searchFields?: string | string[]
  editorName?: string
  /** Cleared on apply; no longer shown in filter UI */
  editCompletedAtFrom?: string
  editCompletedAtTo?: string
  archivedAtFrom?: string
  archivedAtTo?: string
}

import { WAREHOUSE_TT05_SEARCHABLE_FIELDS } from '@/features/archive-warehouse/lib/warehouseMetadataSearchDisplay'

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
  fonds?: Array<ArchiveWarehouseFondListItemT>
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
  /** Element rendered before the filter toggle button on the same row (e.g. search input). */
  leading?: ReactNode
  /** Compact row: search + filter ~1/5 width, right-aligned in parent flex. */
  layout?: 'default' | 'compact'
  /** Hub flat list mode: hide fond multi-select in the filter sheet. */
  hideFondFilter?: boolean
  className?: string
}

function toDraft(values: ArchiveWarehouseFilterValues): FilterDraft {
  return {
    searchFondId: values.searchFondId,
    dossierTypeId: values.dossierTypeId,
    documentTypeId: values.documentTypeId,
    searchFields: values.searchFields,
    editorName: values.editorName,
    archivedAtFrom: values.archivedAtFrom,
    archivedAtTo: values.archivedAtTo,
  }
}

function countActiveFilters(
  values: ArchiveWarehouseFilterValues,
  listBrowseFilters?: WarehouseListBrowseFilters,
  hideFondFilter = false,
): number {
  let count = 0
  if (
    !hideFondFilter &&
    (Array.isArray(values.searchFondId)
      ? values.searchFondId.length > 0
      : values.searchFondId)
  ) {
    count += 1
  }
  if (Array.isArray(values.dossierTypeId) ? values.dossierTypeId.length > 0 : values.dossierTypeId) count += 1
  if (Array.isArray(values.documentTypeId) ? values.documentTypeId.length > 0 : values.documentTypeId) count += 1
  if (Array.isArray(values.searchFields) ? values.searchFields.length > 0 : values.searchFields) count += 1
  if (values.editorName?.trim()) count += 1
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
  leading,
  layout = 'default',
  hideFondFilter = false,
  className,
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
    () => countActiveFilters(values, listBrowseFilters, hideFondFilter),
    [values, listBrowseFilters, hideFondFilter],
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
      searchFields: draft.searchFields,
      editorName: draft.editorName?.trim() || undefined,
      editCompletedAtFrom: undefined,
      editCompletedAtTo: undefined,
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

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(toDraft(values))
      if (listBrowseFilters) {
        setListDraft({
          year: listBrowseFilters.year,
          status: listBrowseFilters.status,
        })
      }
    }
    setOpen(next)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'flex flex-nowrap items-center gap-2',
          layout === 'compact' && 'min-w-0',
        )}
      >
        {leading ? <div className="min-w-0">{leading}</div> : null}

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant={open || activeFilterCount > 0 ? 'default' : 'outline'}
            size="default"
            className="shrink-0 gap-1.5 px-3 sm:px-4"
            aria-label={t('filters.open')}
            onClick={() => handleOpenChange(true)}
          >
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">{t('filters.open')}</span>
            {activeFilterCount > 0 ? (
              <Badge
                variant={open ? 'secondary' : 'default'}
                className="h-5 min-w-5 px-1.5"
              >
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>

        {trailing ? (
          <div className="ml-auto flex items-center gap-2">{trailing}</div>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          ariaTitle={t('filters.title')}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle>{t('filters.title')}</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="flex flex-col gap-6">
              {listBrowseFilters ? (
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
                      <SelectItem value={ALL_YEARS}>
                        {t('filters.allYears')}
                      </SelectItem>
                      {listBrowseFilters.availableYears.map((itemYear) => (
                        <SelectItem key={itemYear} value={String(itemYear)}>
                          {itemYear}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="warehouse-filter-editor">
                  {t('filters.editorName')}
                </Label>
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

              <div className="space-y-2">
                <Label>{t('filters.archived')}</Label>
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={draft.archivedAtFrom}
                    onChange={(date) => patchDraft({ archivedAtFrom: date })}
                    placeholder="Từ ngày"
                    className="w-full"
                  />
                  <span className="text-muted-foreground">-</span>
                  <DatePicker
                    value={draft.archivedAtTo}
                    onChange={(date) => patchDraft({ archivedAtTo: date })}
                    placeholder="Đến ngày"
                    className="w-full"
                  />
                </div>
              </div>

              {!lockedFondId && !hideFondFilter ? (
                <CheckboxGroup
                  title={t('filters.fondList')}
                  items={fonds.map((fond) => ({
                    id: fond.id,
                    label: fond.fondName,
                  }))}
                  selected={draft.searchFondId}
                  onChange={(nextIds) =>
                    patchDraft({
                      searchFondId: nextIds.length > 0 ? nextIds : undefined,
                    })
                  }
                  idPrefix="fond"
                />
              ) : null}

              <>
                <CheckboxGroup
                  title="Loại Hồ sơ"
                    items={dossierTypes.map((item) => ({
                      id: item.id,
                      label: item.name,
                    }))}
                    selected={draft.dossierTypeId}
                    onChange={(nextIds) =>
                      patchDraft({
                        dossierTypeId: nextIds.length > 0 ? nextIds : undefined,
                      })
                    }
                    idPrefix="dossier"
                  />

                  <CheckboxGroup
                    title="Loại Tài liệu"
                    items={documentTypes.map((item) => ({
                      id: item.id,
                      label: item.name,
                    }))}
                    selected={draft.documentTypeId}
                    onChange={(nextIds) =>
                      patchDraft({
                        documentTypeId: nextIds.length > 0 ? nextIds : undefined,
                      })
                    }
                    idPrefix="doc"
                  />

                  <CheckboxGroup
                    title="Trường Metadata (TT05)"
                    items={WAREHOUSE_TT05_SEARCHABLE_FIELDS.map((field) => ({
                      id: field.value,
                      label: field.label,
                    }))}
                    selected={draft.searchFields}
                    onChange={(nextIds) =>
                      patchDraft({
                        searchFields: nextIds.length > 0 ? nextIds : undefined,
                      })
                    }
                    idPrefix="field"
                  />
              </>
            </div>
          </div>

          <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="ghost" onClick={handleClear}>
              {t('filters.clear')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('filters.apply')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CheckboxGroup({
  title,
  items,
  selected,
  onChange,
  idPrefix,
}: {
  title: string
  items: Array<{ id: string; label: string }>
  selected: string | string[] | undefined
  onChange: (ids: Array<string>) => void
  idPrefix: string
}) {
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{title}</Label>
      <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-3 sm:grid-cols-2">
        {items.map((item) => {
          const isChecked = Array.isArray(selected)
            ? selected.includes(item.id)
            : selected === item.id
          return (
            <div key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`${idPrefix}-${item.id}`}
                className="mt-0.5"
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const current = Array.isArray(selected)
                    ? [...selected]
                    : selected
                      ? [selected]
                      : []
                  const nextIds = checked
                    ? [...current, item.id]
                    : current.filter((id) => id !== item.id)
                  onChange(nextIds)
                }}
              />
              <Label
                htmlFor={`${idPrefix}-${item.id}`}
                className="font-normal leading-snug"
              >
                {item.label}
              </Label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function hasWarehouseFilterCriteria(
  values: ArchiveWarehouseFilterValues,
): boolean {
  return Boolean(
    values.q?.trim() ||
    (Array.isArray(values.searchFondId) ? values.searchFondId.length > 0 : values.searchFondId) ||
    (Array.isArray(values.dossierTypeId) ? values.dossierTypeId.length > 0 : values.dossierTypeId) ||
    (Array.isArray(values.documentTypeId) ? values.documentTypeId.length > 0 : values.documentTypeId) ||
    (Array.isArray(values.searchFields) ? values.searchFields.length > 0 : values.searchFields) ||
    values.editorName?.trim() ||
    values.archivedAtFrom ||
    values.archivedAtTo,
  )
}

/** ES is required for document type, metadata fields, or full-text q — not for fond/dossier type filters. */
export function isEsWarehouseSearchRequired(
  values: ArchiveWarehouseFilterValues,
): boolean {
  const hasDocument = Array.isArray(values.documentTypeId)
    ? values.documentTypeId.length > 0
    : values.documentTypeId
  const hasSearchFields = Array.isArray(values.searchFields)
    ? values.searchFields.length > 0
    : values.searchFields
  return Boolean(
    values.q?.trim() ||
      hasDocument ||
      hasSearchFields ||
      values.editorName?.trim() ||
      values.archivedAtFrom ||
      values.archivedAtTo,
  )
}

/** True when fond and/or dossier type filters should use BE SQL browse (not ES). */
export function isDbBrowseWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  if (isEsWarehouseSearchRequired(values)) return false
  const hasFond = resolveWarehouseFondIds(values.searchFondId).length > 0
  const hasDossier = resolveWarehouseDossierTypeIds(values.dossierTypeId).length > 0
  return hasFond || hasDossier
}

/** Flat list mode: all dossiers in scope via BE when fond browse is off and no filters apply. */
export function isFlatWarehouseListBrowse(
  manageByFond: boolean,
  values: ArchiveWarehouseFilterValues,
): boolean {
  if (manageByFond) return false
  return !isEsWarehouseSearchRequired(values) && !isDbBrowseWarehouseFilter(values)
}

/** True when only a fond is selected — browse DB list instead of ES search. */
export function isFondOnlyWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  const hasFond = Array.isArray(values.searchFondId) ? values.searchFondId.length > 0 : values.searchFondId;
  const hasDossier = Array.isArray(values.dossierTypeId) ? values.dossierTypeId.length > 0 : values.dossierTypeId;
  const hasDocument = Array.isArray(values.documentTypeId) ? values.documentTypeId.length > 0 : values.documentTypeId;
  const hasSearchFields = Array.isArray(values.searchFields) ? values.searchFields.length > 0 : values.searchFields;
  return Boolean(
    hasFond &&
    !values.q?.trim() &&
    !hasDossier &&
    !hasDocument &&
    !hasSearchFields &&
    !values.editorName?.trim() &&
    !values.archivedAtFrom &&
    !values.archivedAtTo,
  )
}

/** True when only dossier type(s) are selected — browse DB list instead of ES search. */
export function isDossierTypeOnlyWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  const hasFond = Array.isArray(values.searchFondId)
    ? values.searchFondId.length > 0
    : values.searchFondId
  const hasDossier = Array.isArray(values.dossierTypeId)
    ? values.dossierTypeId.length > 0
    : values.dossierTypeId
  const hasDocument = Array.isArray(values.documentTypeId)
    ? values.documentTypeId.length > 0
    : values.documentTypeId
  const hasSearchFields = Array.isArray(values.searchFields)
    ? values.searchFields.length > 0
    : values.searchFields
  return Boolean(
    hasDossier &&
    !values.q?.trim() &&
    !hasFond &&
    !hasDocument &&
    !hasSearchFields &&
    !values.editorName?.trim() &&
    !values.archivedAtFrom &&
    !values.archivedAtTo,
  )
}

export function resolveWarehouseDossierTypeIds(
  dossierTypeId: string | string[] | undefined,
): string[] {
  if (Array.isArray(dossierTypeId)) {
    return dossierTypeId.filter((id) => id && id !== ALL_VALUE)
  }
  if (!dossierTypeId || dossierTypeId === ALL_VALUE) return []
  return [dossierTypeId]
}

export function isSingleFondOnlyWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  return resolveWarehouseFondIds(values.searchFondId).length === 1 &&
    isFondOnlyWarehouseFilter(values)
}

export function isSingleDossierTypeOnlyWarehouseFilter(
  values: ArchiveWarehouseFilterValues,
): boolean {
  return resolveWarehouseDossierTypeIds(values.dossierTypeId).length === 1 &&
    isDossierTypeOnlyWarehouseFilter(values)
}

export function resolveWarehouseFondIds(
  searchFondId: string | string[] | undefined,
): string[] {
  if (Array.isArray(searchFondId)) {
    return searchFondId.filter((id) => id && id !== ALL_VALUE)
  }
  if (!searchFondId || searchFondId === ALL_VALUE) return []
  return [searchFondId]
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
    (Array.isArray(values.searchFondId)
      ? values.searchFondId.length > 0 ? values.searchFondId : undefined
      : values.searchFondId && values.searchFondId !== ALL_VALUE
        ? values.searchFondId
        : undefined)

  const mode = q ? ('all' as const) : ('metadata' as const)

  return {
    mode,
    q: q || undefined,
    fondId,
    dossierTypeId: values.dossierTypeId,
    documentTypeId: values.documentTypeId,
    searchFields: values.searchFields,
    editorName: values.editorName?.trim() || undefined,
    archivedAtFrom: values.archivedAtFrom,
    archivedAtTo: values.archivedAtTo,
    limit: opts.limit,
    offset: (opts.page - 1) * opts.limit,
  }
}
