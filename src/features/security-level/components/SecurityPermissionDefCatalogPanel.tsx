import { useQuery } from '@tanstack/react-query'
import type { Row } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { GeneralCatalogListToolbar } from '@/features/general-catalog/components/GeneralCatalogListToolbar'
import { SecurityPermissionDefDeleteDialog } from '@/features/security-level/components/SecurityPermissionDefDeleteDialog'
import { SecurityPermissionDefFormDialog } from '@/features/security-level/components/SecurityPermissionDefFormDialog'
import { useSecurityLevelAccess } from '@/features/security-level/hooks/useSecurityLevelAccess'
import {
  securityPermissionDefsQueryOptions,
  useUpdateSecurityPermissionDef,
} from '@/features/security-level/queries'
import type { SecurityPermissionDefT } from '@/features/security-level/types'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

function toTableRow(
  permissionDef: SecurityPermissionDefT,
): Row<SecurityPermissionDefT> {
  return { original: permissionDef } as Row<SecurityPermissionDefT>
}

export function SecurityPermissionDefCatalogPanel() {
  const { t } = useTranslation('security-level')
  const [q, setQ] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_LIST_PAGE_LIMIT)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<SecurityPermissionDefT | null>(null)

  const {
    canCreateSecurityLevels,
    canUpdateSecurityLevels,
    canDeleteSecurityLevels,
  } = useSecurityLevelAccess()
  const updateDef = useUpdateSecurityPermissionDef()

  const { data, isPending, isFetching, isError } = useQuery(
    securityPermissionDefsQueryOptions({
      search: q || undefined,
      page,
      limit,
    }),
  )
  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    if (safePage !== page) setPage(safePage)
  }, [safePage, page])

  function submitSearch() {
    setQ(inputValue.trim())
    setPage(1)
  }

  const showInitialLoading = isPending && items.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <GeneralCatalogListToolbar
          searchValue={inputValue}
          onSearchChange={setInputValue}
          onSearch={submitSearch}
          searchPlaceholder={t('permissions.search.placeholder')}
          createLabel={t('permissions.actions.create')}
          onCreate={() => {
            setSelected(null)
            setFormOpen(true)
          }}
          canCreate={canCreateSecurityLevels}
        />
      </div>

      {isError ? (
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">
            {t('permissions.errors.loadFailed')}
          </p>
        </div>
      ) : null}

      <Card
        variant="list"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {isFetching && !showInitialLoading ? (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center bg-background/60 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto">
          {showInitialLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table className="w-full min-w-[720px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[18%]">
                    {t('permissions.table.columns.key')}
                  </TableHead>
                  <TableHead className="w-[22%]">
                    {t('permissions.table.columns.name')}
                  </TableHead>
                  <TableHead className="w-[28%]">
                    {t('permissions.table.columns.description')}
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    {t('permissions.table.columns.system')}
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    {t('permissions.table.columns.active')}
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    {t('permissions.table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('permissions.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((def) => (
                    <TableRow
                      key={def.id}
                      className={
                        !def.isActive
                          ? 'opacity-50 grayscale transition-opacity'
                          : 'transition-opacity'
                      }
                    >
                      <TableCell className="align-top font-mono text-sm">
                        {def.key}
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{def.name}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{def.description}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top text-center text-sm">
                        {def.isSystem
                          ? t('permissions.table.systemYes')
                          : t('permissions.table.systemNo')}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex h-8 items-center justify-center">
                          <Switch
                            checked={def.isActive === true}
                            onCheckedChange={() =>
                              updateDef.mutate({
                                id: def.id,
                                payload: { isActive: !def.isActive },
                              })
                            }
                            disabled={
                              !canUpdateSecurityLevels || updateDef.isPending
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center justify-end">
                          <DataTableRowActions
                            row={toTableRow(def)}
                            onEdit={
                              canUpdateSecurityLevels
                                ? (item) => {
                                    setSelected(item)
                                    setFormOpen(true)
                                  }
                                : undefined
                            }
                            onDelete={
                              canDeleteSecurityLevels && !def.isSystem
                                ? (item) => {
                                    setSelected(item)
                                    setDeleteOpen(true)
                                  }
                                : undefined
                            }
                          />
                        </div>
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
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit)
          setPage(1)
        }}
      />

      <SecurityPermissionDefFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelected(null)
        }}
        permissionDef={selected}
      />

      <SecurityPermissionDefDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelected(null)
        }}
        permissionDef={selected}
      />
    </div>
  )
}
