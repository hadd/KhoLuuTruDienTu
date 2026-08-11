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

import { ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveWarehouseBrowseTabConfig'
import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import type { ArchiveWarehouseFondListItemT } from '@/features/archive-warehouse/types'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { WarehouseDossierStatusT } from '@/features/archive-warehouse/types'
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
  editCompletedAtFrom?: string
  editCompletedAtTo?: string
  archivedAtFrom?: string
  archivedAtTo?: string
}

const TT05_SEARCHABLE_FIELDS = [
  { value: 'MA_HO_SO', label: 'Mã hồ sơ' },
  { value: 'TIEU_DE_HO_SO', label: 'Tiêu đề hồ sơ' },
  { value: 'MA_DINH_DANH_TAI_LIEU', label: 'Mã định danh tài liệu' },
  { value: 'MA_LUU_TRU_TAI_LIEU', label: 'Mã lưu trữ tài liệu' },
  { value: 'TEN_LOAI_TAI_LIEU', label: 'Tên loại tài liệu' },
  { value: 'SO_CUA_TAI_LIEU', label: 'Số của tài liệu' },
  { value: 'KY_HIEU_CUA_TAI_LIEU', label: 'Ký hiệu của tài liệu' },
  { value: 'TEN_CO_QUAN_BAN_HANH', label: 'Tên cơ quan ban hành' },
  { value: 'TRICH_YEU_NOI_DUNG', label: 'Trích yếu nội dung' },
  { value: 'NGON_NGU', label: 'Ngôn ngữ' },
  { value: 'BUT_TICH', label: 'Bút tích' },
  { value: 'QUY_TRINH_XU_LY', label: 'Quy trình xử lý' },
  { value: 'CHE_DO_LAP_TAI_LIEU_DU_PHONG', label: 'Chế độ lập tài liệu dự phòng' },
  { value: 'TINH_TRANG_LAP_TAI_LIEU_DU_PHONG', label: 'Tình trạng lập tài liệu dự phòng' },
  { value: 'TU_KHOA', label: 'Từ khóa' },
]

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
  onChange: (
    patch: Partial<ArchiveWarehouseFilterValues> & {
      browseView?: ArchiveWarehouseBrowseViewT
    },
  ) => void
  onClear: () => void
  fonds?: Array<ArchiveWarehouseFondListItemT>
  /** Hub "Hồ sơ đã lưu kho": group by fond / type / unassigned via filter. */
  browseView?: ArchiveWarehouseBrowseViewT
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
  className?: string
}

function toDraft(values: ArchiveWarehouseFilterValues): FilterDraft {
  return {
    searchFondId: values.searchFondId,
    dossierTypeId: values.dossierTypeId,
    documentTypeId: values.documentTypeId,
    searchFields: values.searchFields,
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
  browseView?: ArchiveWarehouseBrowseViewT,
): number {
  let count = 0
  if (browseView && browseView !== 'fonds') count += 1
  if (Array.isArray(values.searchFondId) ? values.searchFondId.length > 0 : values.searchFondId) count += 1
  if (Array.isArray(values.dossierTypeId) ? values.dossierTypeId.length > 0 : values.dossierTypeId) count += 1
  if (Array.isArray(values.documentTypeId) ? values.documentTypeId.length > 0 : values.documentTypeId) count += 1
  if (Array.isArray(values.searchFields) ? values.searchFields.length > 0 : values.searchFields) count += 1
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
  browseView,
  lockedFondId,
  searchPlaceholder,
  listBrowseFilters,
  onListBrowseFiltersChange,
  trailing,
  leading,
  layout = 'default',
  className,
}: ArchiveWarehouseSearchFiltersProps) {
  const { t } = useTranslation('archive-warehouse')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(values))
  const [browseDraft, setBrowseDraft] = useState<
    ArchiveWarehouseBrowseViewT | undefined
  >(browseView)
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
    () => countActiveFilters(values, listBrowseFilters, browseView),
    [values, listBrowseFilters, browseView],
  )

  useEffect(() => {
    setBrowseDraft(browseView)
  }, [browseView])

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
      editCompletedAtFrom: draft.editCompletedAtFrom,
      editCompletedAtTo: draft.editCompletedAtTo,
      archivedAtFrom: draft.archivedAtFrom,
      archivedAtTo: draft.archivedAtTo,
      q: searchInput.trim() || undefined,
      ...(browseView != null ? { browseView: browseDraft ?? 'fonds' } : {}),
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
    if (browseView != null) setBrowseDraft('fonds')
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
      setBrowseDraft(browseView)
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
          <div className="flex items-center gap-2 sm:ml-auto">{trailing}</div>
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
              {browseView != null ? (
                <div className="space-y-2">
                  <Label htmlFor="warehouse-filter-browse">
                    {t('filters.browseView')}
                  </Label>
                  <Select
                    value={browseDraft ?? 'fonds'}
                    onValueChange={(next) =>
                      setBrowseDraft(next as ArchiveWarehouseBrowseViewT)
                    }
                  >
                    <SelectTrigger id="warehouse-filter-browse" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {t(item.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

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
                <Label>{t('filters.editCompleted')}</Label>
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={draft.editCompletedAtFrom}
                    onChange={(date) =>
                      patchDraft({ editCompletedAtFrom: date })
                    }
                    placeholder="Từ ngày"
                    className="w-full"
                  />
                  <span className="text-muted-foreground">-</span>
                  <DatePicker
                    value={draft.editCompletedAtTo}
                    onChange={(date) => patchDraft({ editCompletedAtTo: date })}
                    placeholder="Đến ngày"
                    className="w-full"
                  />
                </div>
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

              {browseDraft !== 'unassigned' && !lockedFondId ? (
                <CheckboxGroup
                  title="Danh sách Phông"
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

              {browseDraft !== 'unassigned' ? (
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
                    items={TT05_SEARCHABLE_FIELDS.map((field) => ({
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
              ) : null}
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
    editCompletedAtFrom: values.editCompletedAtFrom,
    editCompletedAtTo: values.editCompletedAtTo,
    archivedAtFrom: values.archivedAtFrom,
    archivedAtTo: values.archivedAtTo,
    limit: opts.limit,
    offset: (opts.page - 1) * opts.limit,
  }
}
