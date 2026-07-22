import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { TextBlock } from '@/components/common/TextBlock'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DocumentTypeDeleteDialog } from '@/features/document-type/components/DocumentTypeDeleteDialog'
import { DocumentTypeFormDialog } from '@/features/document-type/components/DocumentTypeFormDialog'
import { useDocumentTypeAccess } from '@/features/document-type/hooks/useDocumentTypeAccess'
import {
  documentTypesQueryOptions,
  useUpdateDocumentType,
} from '@/features/document-type/queries'
import type { DocumentTypeT } from '@/features/document-type/types'
import { GeneralCatalogListToolbar } from '@/features/general-catalog/components/GeneralCatalogListToolbar'
import { GeneralCatalogSectionTabs } from '@/features/general-catalog/components/GeneralCatalogSectionTabs'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { activeRetentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/document-types/')

function toTableRow(documentType: DocumentTypeT): Row<DocumentTypeT> {
  return { original: documentType } as Row<DocumentTypeT>
}

export function DocumentTypeManagementPage() {
  const { t } = useTranslation('document-type')
  const { t: tRetention } = useTranslation('retention-period')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDocumentType, setSelectedDocumentType] =
    useState<DocumentTypeT | null>(null)
  const {
    canCreateDocumentTypes,
    canUpdateDocumentTypes,
    canDeleteDocumentTypes,
  } = useDocumentTypeAccess()
  const updateDocumentType = useUpdateDocumentType()

  const { data, isPending, isFetching, isError } = useQuery(
    documentTypesQueryOptions({ search: q, page, limit }),
  )
  const { data: retentionData } = useQuery(activeRetentionPeriodsQueryOptions())

  const retentionLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const period of retentionData?.items ?? []) {
      map.set(period.id, formatRetentionDurationLabel(period, tRetention))
    }
    return map
  }, [retentionData?.items, tRetention])

  const documentTypes = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }

  useEffect(() => {
    if (isPending || isFetching || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, isPending, isFetching, data])

  const handleCreate = () => {
    setSelectedDocumentType(null)
    setFormOpen(true)
  }

  const handleEdit = (documentType: DocumentTypeT) => {
    setSelectedDocumentType(documentType)
    setFormOpen(true)
  }

  const handleDelete = (documentType: DocumentTypeT) => {
    setSelectedDocumentType(documentType)
    setDeleteOpen(true)
  }

  const handleToggleActive = (documentType: DocumentTypeT) => {
    updateDocumentType.mutate({
      id: documentType.id,
      payload: { isActive: !documentType.isActive },
    })
  }

  const showInitialLoading = isPending && documentTypes.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <GeneralCatalogSectionTabs active="document-type" />
      <GeneralCatalogListToolbar
        searchValue={inputValue}
        onSearchChange={setInputValue}
        onSearch={submitSearch}
        searchPlaceholder={t('search.placeholder')}
        createLabel={t('actions.create')}
        onCreate={handleCreate}
        canCreate={canCreateDocumentTypes}
      />

      {isError && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
        </div>
      )}

      <Card
        variant="list"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {isFetching && !showInitialLoading && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center bg-background/60 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {showInitialLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table className="w-full min-w-[880px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[12%]">
                    {t('table.columns.id')}
                  </TableHead>
                  <TableHead className="w-[18%]">
                    {t('table.columns.name')}
                  </TableHead>
                  <TableHead className="w-[22%]">
                    {t('table.columns.description')}
                  </TableHead>
                  <TableHead className="w-[20%]">
                    {t('table.columns.retentionPeriod')}
                  </TableHead>
                  <TableHead className="w-[10%] text-center">
                    {t('table.columns.active')}
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    {t('table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentTypes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  documentTypes.map((documentType) => (
                    <TableRow
                      key={documentType.id}
                      className={
                        !documentType.isActive
                          ? 'opacity-50 grayscale transition-opacity'
                          : 'transition-opacity'
                      }
                    >
                      <TableCell className="align-top font-medium">
                        <TextBlock lines={1}>{documentType.id}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{documentType.name}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>
                          {documentType.description}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>
                          {documentType.retentionPeriodId
                            ? (retentionLabelById.get(
                                documentType.retentionPeriodId,
                              ) ?? documentType.retentionPeriodId)
                            : t('table.retentionPeriodNone')}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex h-8 items-center justify-center">
                          <Switch
                            checked={documentType.isActive === true}
                            onCheckedChange={() =>
                              handleToggleActive(documentType)
                            }
                            disabled={
                              !canUpdateDocumentTypes ||
                              updateDocumentType.isPending
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <DataTableRowActions
                          row={toTableRow(documentType)}
                          onEdit={
                            canUpdateDocumentTypes ? handleEdit : undefined
                          }
                          onDelete={
                            canDeleteDocumentTypes && !documentType.inUse
                              ? handleDelete
                              : undefined
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ListPagePagination
        page={safePage}
        totalPages={totalPages}
        limit={limit}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(nextPage) => {
          void navigate({
            search: (prev) => ({ ...prev, page: nextPage }),
            replace: true,
          })
        }}
        onLimitChange={(nextLimit) => {
          void navigate({
            search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
            replace: true,
          })
        }}
      />

      <DocumentTypeFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedDocumentType(null)
        }}
        documentType={selectedDocumentType}
      />

      <DocumentTypeDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedDocumentType(null)
        }}
        documentType={selectedDocumentType}
      />
    </div>
  )
}
