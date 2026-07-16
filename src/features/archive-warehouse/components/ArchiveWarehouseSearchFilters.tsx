import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
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
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveFondT } from '@/features/archive-fond/types'

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
  const dossierTypesQuery = useQuery(archiveWarehouseDossierTypesQueryOptions())
  const documentTypesQuery = useQuery(archiveWarehouseDocumentTypesQueryOptions())

  const dossierTypes = dossierTypesQuery.data?.items ?? []
  const documentTypes = documentTypesQuery.data?.items ?? []

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!lockedFondId ? (
          <div className="space-y-1.5">
            <Label>{t('filters.fond')}</Label>
            <Select
              value={values.searchFondId ?? ALL_VALUE}
              onValueChange={(next) =>
                onChange({
                  searchFondId: next === ALL_VALUE ? undefined : next,
                })
              }
            >
              <SelectTrigger aria-label={t('filters.fond')}>
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

        <div className="space-y-1.5">
          <Label>{t('filters.dossierType')}</Label>
          <Select
            value={values.dossierTypeId ?? ALL_VALUE}
            onValueChange={(next) =>
              onChange({
                dossierTypeId: next === ALL_VALUE ? undefined : next,
              })
            }
          >
            <SelectTrigger aria-label={t('filters.dossierType')}>
              <SelectValue placeholder={t('filters.dossierType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('filters.allDossierTypes')}</SelectItem>
              {dossierTypes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.documentType')}</Label>
          <Select
            value={values.documentTypeId ?? ALL_VALUE}
            onValueChange={(next) =>
              onChange({
                documentTypeId: next === ALL_VALUE ? undefined : next,
              })
            }
          >
            <SelectTrigger aria-label={t('filters.documentType')}>
              <SelectValue placeholder={t('filters.documentType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('filters.allDocumentTypes')}</SelectItem>
              {documentTypes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warehouse-editor-name">{t('filters.editorName')}</Label>
          <Input
            id="warehouse-editor-name"
            value={values.editorName ?? ''}
            onChange={(event) =>
              onChange({
                editorName: event.target.value.trim()
                  ? event.target.value
                  : undefined,
              })
            }
            placeholder={t('filters.editorNamePlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warehouse-edit-from">{t('filters.editCompletedFrom')}</Label>
          <Input
            id="warehouse-edit-from"
            type="date"
            value={values.editCompletedAtFrom ?? ''}
            onChange={(event) =>
              onChange({
                editCompletedAtFrom: event.target.value || undefined,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warehouse-edit-to">{t('filters.editCompletedTo')}</Label>
          <Input
            id="warehouse-edit-to"
            type="date"
            value={values.editCompletedAtTo ?? ''}
            onChange={(event) =>
              onChange({
                editCompletedAtTo: event.target.value || undefined,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warehouse-archived-from">{t('filters.archivedFrom')}</Label>
          <Input
            id="warehouse-archived-from"
            type="date"
            value={values.archivedAtFrom ?? ''}
            onChange={(event) =>
              onChange({
                archivedAtFrom: event.target.value || undefined,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="warehouse-archived-to">{t('filters.archivedTo')}</Label>
          <Input
            id="warehouse-archived-to"
            type="date"
            value={values.archivedAtTo ?? ''}
            onChange={(event) =>
              onChange({
                archivedAtTo: event.target.value || undefined,
              })
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onSubmitSearch}>
          {t('filters.apply')}
        </Button>
        <Button type="button" variant="outline" onClick={onClear}>
          {t('filters.clear')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('filters.andHint')}</p>
      </div>
    </section>
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
