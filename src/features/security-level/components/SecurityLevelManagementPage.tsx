import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralCatalogListToolbar } from '@/features/general-catalog/components/GeneralCatalogListToolbar'
import { GeneralCatalogSectionTabs } from '@/features/general-catalog/components/GeneralCatalogSectionTabs'
import {
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
} from '@/features/navigation/components/SectionBackNav'
import { SecurityLevelConfigDialog } from '@/features/security-level/components/SecurityLevelConfigDialog'
import { SecurityLevelDeleteDialog } from '@/features/security-level/components/SecurityLevelDeleteDialog'
import { SecurityLevelFormDialog } from '@/features/security-level/components/SecurityLevelFormDialog'
import { SecurityPermissionDefCatalogPanel } from '@/features/security-level/components/SecurityPermissionDefCatalogPanel'
import { useSecurityLevelAccess } from '@/features/security-level/hooks/useSecurityLevelAccess'
import {
  securityLevelsQueryOptions,
  useUpdateSecurityLevel,
} from '@/features/security-level/queries'
import type { SecurityLevelT } from '@/features/security-level/types'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/security-levels/')

function toTableRow(securityLevel: SecurityLevelT): Row<SecurityLevelT> {
  return { original: securityLevel } as Row<SecurityLevelT>
}

export function SecurityLevelManagementPage() {
  const { t } = useTranslation('security-level')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [pageTab, setPageTab] = useState<'levels' | 'permissions'>('levels')
  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSecurityLevel, setSelectedSecurityLevel] =
    useState<SecurityLevelT | null>(null)
  const {
    canCreateSecurityLevels,
    canUpdateSecurityLevels,
    canDeleteSecurityLevels,
    canConfigSecurityLevels,
    canViewSecurityPermissionDefs,
  } = useSecurityLevelAccess()
  const updateSecurityLevel = useUpdateSecurityLevel()

  useEffect(() => {
    if (!canViewSecurityPermissionDefs && pageTab === 'permissions') {
      setPageTab('levels')
    }
  }, [canViewSecurityPermissionDefs, pageTab])

  const { data, isPending, isFetching, isError } = useQuery(
    securityLevelsQueryOptions({ search: q, page, limit }),
  )
  const securityLevels = [...(data?.items ?? [])].sort(
    (a, b) => a.levelOrder - b.levelOrder,
  )
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
    setSelectedSecurityLevel(null)
    setFormOpen(true)
  }

  const handleEdit = (securityLevel: SecurityLevelT) => {
    setSelectedSecurityLevel(securityLevel)
    setFormOpen(true)
  }

  const handleConfig = (securityLevel: SecurityLevelT) => {
    setSelectedSecurityLevel(securityLevel)
    setConfigOpen(true)
  }

  const handleDelete = (securityLevel: SecurityLevelT) => {
    setSelectedSecurityLevel(securityLevel)
    setDeleteOpen(true)
  }

  const handleToggleActive = (securityLevel: SecurityLevelT) => {
    updateSecurityLevel.mutate({
      id: securityLevel.id,
      payload: { isActive: !securityLevel.isActive },
    })
  }

  const showInitialLoading = isPending && securityLevels.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <GeneralCatalogSectionTabs active="security-level" />

      <Tabs
        value={pageTab}
        onValueChange={(value) =>
          setPageTab(value as 'levels' | 'permissions')
        }
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
      >
        <TabsList className={cn(sectionBoxedSubTabsListClassName, 'shrink-0')}>
          <TabsTrigger
            value="levels"
            className={sectionBoxedSubTabsTriggerClassName}
          >
            {t('pageTabs.levels')}
          </TabsTrigger>
          {canViewSecurityPermissionDefs ? (
            <TabsTrigger
              value="permissions"
              className={sectionBoxedSubTabsTriggerClassName}
            >
              {t('pageTabs.permissions')}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent
          value="levels"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden data-[state=inactive]:hidden"
        >
          <GeneralCatalogListToolbar
            showSearch={false}
            createLabel={t('actions.create')}
            onCreate={handleCreate}
            canCreate={canCreateSecurityLevels}
          />

          {isError && (
            <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
              <p className="text-sm text-muted-foreground">
                {t('errors.loadFailed')}
              </p>
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
                <Table className="w-full min-w-[720px] table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[10%] text-center">
                        {t('table.columns.levelOrder')}
                      </TableHead>
                      <TableHead className="w-[26%]">
                        {t('table.columns.name')}
                      </TableHead>
                      <TableHead className="w-[40%]">
                        {t('table.columns.description')}
                      </TableHead>
                      <TableHead className="w-[12%] text-center">
                        {t('table.columns.active')}
                      </TableHead>
                      <TableHead className="w-24 text-right">
                        {t('table.columns.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityLevels.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {t('empty')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      securityLevels.map((securityLevel) => (
                        <TableRow
                          key={securityLevel.id}
                          className={
                            !securityLevel.isActive
                              ? 'opacity-50 grayscale transition-opacity'
                              : 'transition-opacity'
                          }
                        >
                          <TableCell className="text-center align-top font-medium">
                            {securityLevel.levelOrder}
                          </TableCell>
                          <TableCell className="align-top">
                            <TextBlock lines={2}>{securityLevel.name}</TextBlock>
                          </TableCell>
                          <TableCell className="align-top">
                            <TextBlock lines={2}>
                              {securityLevel.description}
                            </TextBlock>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex h-8 items-center justify-center">
                              <Switch
                                checked={securityLevel.isActive === true}
                                onCheckedChange={() =>
                                  handleToggleActive(securityLevel)
                                }
                                disabled={
                                  !canUpdateSecurityLevels ||
                                  updateSecurityLevel.isPending
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center justify-end gap-1">
                              {canConfigSecurityLevels ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleConfig(securityLevel)}
                                  aria-label={t('actions.config')}
                                >
                                  <Settings2 className="size-4" />
                                </Button>
                              ) : null}
                              <DataTableRowActions
                                row={toTableRow(securityLevel)}
                                onEdit={
                                  canUpdateSecurityLevels
                                    ? handleEdit
                                    : undefined
                                }
                                onDelete={
                                  canDeleteSecurityLevels
                                    ? handleDelete
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
        </TabsContent>

        {canViewSecurityPermissionDefs ? (
          <TabsContent
            value="permissions"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <SecurityPermissionDefCatalogPanel />
          </TabsContent>
        ) : null}
      </Tabs>

      <SecurityLevelFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedSecurityLevel(null)
        }}
        securityLevel={selectedSecurityLevel}
      />

      <SecurityLevelConfigDialog
        open={configOpen}
        onOpenChange={(nextOpen) => {
          setConfigOpen(nextOpen)
          if (!nextOpen) setSelectedSecurityLevel(null)
        }}
        securityLevel={selectedSecurityLevel}
      />

      <SecurityLevelDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedSecurityLevel(null)
        }}
        securityLevel={selectedSecurityLevel}
      />
    </div>
  )
}
