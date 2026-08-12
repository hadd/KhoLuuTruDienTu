import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Download, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWarehouseDisposalPicker } from '@/features/archive-disposal/hooks/useWarehouseDisposalPicker'
import { ArchiveWarehouseExportDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseExportDialog'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import { canExportDossiers } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import { archiveWarehouseUnassignedDossiersQueryOptions } from '@/features/archive-warehouse/queries'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'

type ArchiveWarehouseUnassignedSectionProps = {
  page?: number
  limit?: number
  search?: string
  pickerMode?: boolean
  disposalCatalogId?: string | null
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void
}

export function ArchiveWarehouseUnassignedSection({
  page = 1,
  limit = DEFAULT_LIST_PAGE_LIMIT,
  search,
  pickerMode = false,
  disposalCatalogId,
  onPageChange,
  onLimitChange,
}: ArchiveWarehouseUnassignedSectionProps) {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const navigate = useNavigate()
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const { data: profile } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(profile)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })
  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(profile, rolePermissions?.rules.permissions),
    [profile, rolePermissions?.rules.permissions],
  )
  const showDownload = canExportDossiers(permissions) && !pickerMode

  const {
    showPickerSelection: _hookPickerSelection,
    showRowSelection: hookRowSelection,
    pickerTransferMutation,
    transferItems,
  } = useWarehouseDisposalPicker({
    pickerMode,
    disposalCatalogId,
    showDownload,
    onTransferSuccess: () => setSelectedIds(new Set()),
  })
  const showPickerSelection = false
  const showRowSelection = showDownload || showPickerSelection

  const { data, isPending, isFetching } = useQuery(
    archiveWarehouseUnassignedDossiersQueryOptions({
      page,
      limit,
      search: search || undefined,
    }),
  )

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const selectableIds = items.map((item) => item.id)
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length
  const allSelected =
    selectableIds.length > 0 && selectedCount === selectableIds.length
  const someSelected = selectedCount > 0 && selectedCount < selectableIds.length
  const selectedDossierIds = Array.from(selectedIds)
  const hasSelection = selectedDossierIds.length > 0

  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, limit, search])

  function openDossier(dossierId: string) {
    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: { fondId: UNASSIGNED_WAREHOUSE_FOND_ID, dossierId },
      search: buildArchiveDossierDetailSearch({ browseView: 'unassigned' }),
      state: { fromArchiveWarehouseList: true },
    })
  }

  function toggleDossierSelection(dossierId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(dossierId)
    } else {
      next.delete(dossierId)
    }
    setSelectedIds(next)
  }

  function toggleSelectAllOnPage(checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      selectableIds.forEach((id) => next.add(id))
    } else {
      selectableIds.forEach((id) => next.delete(id))
    }
    setSelectedIds(next)
  }

  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t('page.unassignedDossiersEmpty')}
      </Card>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      {showPickerSelection || showDownload ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasSelection ? (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {t('export.selectedCount', { count: selectedDossierIds.length })}
            </span>
          ) : null}
          {showPickerSelection ? (
            <Button
              type="button"
              disabled={
                !hasSelection ||
                pickerTransferMutation.isPending ||
                !disposalCatalogId
              }
              onClick={() => {
                transferItems(
                  selectedDossierIds.map((dossierId) => ({
                    dossierId,
                    source: 'WAREHOUSE' as const,
                  })),
                )
              }}
            >
              {pickerTransferMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              {tDisposal('disposal.addToCatalog', { count: selectedCount })}
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              disabled={!hasSelection}
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="mr-2 size-4" aria-hidden />
              {t('export.downloadButton')}
            </Button>
          )}
        </div>
      ) : null}

      <Card variant="list" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table
            className="w-full min-w-[720px] border-separate border-spacing-0"
            containerClassName="h-full min-h-0 overflow-auto"
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow className="hover:bg-muted">
                {showRowSelection ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) =>
                        toggleSelectAllOnPage(checked === true)
                      }
                      aria-label={t('table.selectAll')}
                    />
                  </TableHead>
                ) : null}
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.physicalLocation')}</TableHead>
                <TableHead>{t('table.documentCount')}</TableHead>
                <TableHead>{t('table.archivedAt')}</TableHead>
                <TableHead>{t('table.path')}</TableHead>
                <TableHead>{t('table.dossierType')}</TableHead>
                <TableHead>{t('table.archiveStorageState')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={showPickerSelection ? undefined : 'cursor-pointer'}
                  onClick={
                    showPickerSelection ? undefined : () => openDossier(item.id)
                  }
                >
                  {showRowSelection ? (
                    <TableCell
                      className="w-10"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) =>
                          toggleDossierSelection(item.id, checked === true)
                        }
                        aria-label={t('table.select')}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-[180px] truncate font-medium">
                    {item.name}
                  </TableCell>
                  <TableCell>
                    {item.hasPhysicalPlacement ? (
                      <span className="text-sm">
                        {item.physicalBoxName ?? '—'}
                      </span>
                    ) : (
                      <Badge variant="secondary">
                        {t('table.physicalUnplaced')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.documentCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {item.archivedAt
                      ? formatDate(item.archivedAt, 'P', dateLocale)
                      : '—'}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {item.folderPath ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate">
                    {item.dossierTypeName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(`archiveStorageState.${item.archiveStorageState}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {onPageChange && onLimitChange ? (
        <div className="shrink-0">
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
          />
        </div>
      ) : null}

      {isFetching && !isPending ? (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      <ArchiveWarehouseExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        dossierIds={selectedDossierIds}
        dossierNames={selectedDossierIds.map(
          (id) => items.find((item) => item.id === id)?.name ?? '',
        )}
        onExported={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
