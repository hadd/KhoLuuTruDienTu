import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateRangePicker } from '@/components/common/date/DateRangePicker'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'

const ALL_VALUE = 'ALL'

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
}: ArchiveWarehouseSearchFiltersProps) {
  const { t } = useTranslation('archive-warehouse')
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(values))

  const dossierTypesQuery = useQuery(archiveWarehouseDossierTypesQueryOptions())
  const documentTypesQuery = useQuery(archiveWarehouseDocumentTypesQueryOptions())

  const dossierTypes = dossierTypesQuery.data?.items ?? []
  const documentTypes = documentTypesQuery.data?.items ?? []

  useEffect(() => {
    setDraft(toDraft(values))
  }, [values])

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
  }

  function handleClear() {
    setDraft({})
    onClear()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!lockedFondId ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-foreground">
              {t('filters.fond')}
            </span>
            <Select
              value={draft.searchFondId ?? ALL_VALUE}
              onValueChange={(next) =>
                patchDraft({
                  searchFondId: next === ALL_VALUE ? undefined : next,
                })
              }
            >
              <SelectTrigger className="h-9 w-[10.5rem]" aria-label={t('filters.fond')}>
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

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-foreground">
            {t('filters.dossierType')}
          </span>
          <Select
            value={draft.dossierTypeId ?? ALL_VALUE}
            onValueChange={(next) =>
              patchDraft({
                dossierTypeId: next === ALL_VALUE ? undefined : next,
              })
            }
          >
            <SelectTrigger
              className="h-9 w-[11rem]"
              aria-label={t('filters.dossierType')}
            >
              <SelectValue placeholder={t('filters.dossierType')} />
            </SelectTrigger>
            <SelectContent>
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

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-foreground">
            {t('filters.documentType')}
          </span>
          <Select
            value={draft.documentTypeId ?? ALL_VALUE}
            onValueChange={(next) =>
              patchDraft({
                documentTypeId: next === ALL_VALUE ? undefined : next,
              })
            }
          >
            <SelectTrigger
              className="h-9 w-[11rem]"
              aria-label={t('filters.documentType')}
            >
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

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-foreground">
            {t('filters.editorName')}
          </span>
          <Input
            className="h-9 w-[10.5rem]"
            value={draft.editorName ?? ''}
            onChange={(event) =>
              patchDraft({
                editorName: event.target.value,
              })
            }
            placeholder={t('filters.editorNamePlaceholder')}
            aria-label={t('filters.editorName')}
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
        />

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleApply}>
            {t('filters.apply')}
          </Button>
          <Button type="button" variant="ghost" onClick={handleClear}>
            {t('filters.clear')}
          </Button>
        </div>
      </div>

      <ListPageSearchInput
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
    </div>
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
