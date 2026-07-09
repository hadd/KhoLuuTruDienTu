import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePagination } from '@/components/common/data-table/data-table-pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreateGroupDialog } from '@/features/group/components/CreateGroupDialog'
import { GroupTable } from '@/features/group/components/GroupTable'
import {
  ADMIN_GROUPS_PAGE_SIZE_OPTIONS,
  adminGroupsQueryOptions,
  DEFAULT_ADMIN_GROUPS_LIMIT,
} from '@/features/group/queries'

const routeApi = getRouteApi('/app/groups/')

export function GroupManagementPage() {
  const { t } = useTranslation('group')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [createGroupOpen, setCreateGroupOpen] = useState(false)

  const currentPage = search.page ?? 1
  const currentLimit = search.limit ?? DEFAULT_ADMIN_GROUPS_LIMIT

  const {
    data: groupsData,
    isPending,
    isFetching,
    isError,
  } = useQuery(
    adminGroupsQueryOptions({
      page: currentPage,
      limit: currentLimit,
    }),
  )

  const total = groupsData?.total ?? 0
  const totalPages = Math.max(1, groupsData?.totalPages ?? 1)
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)

  const handleSelectGroup = (groupId: string) => {
    void navigate({
      to: '/app/groups/$groupId',
      params: { groupId },
      search: (prev) => prev,
    })
  }

  const showInitialLoading = isPending && !groupsData

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button type="button" onClick={() => setCreateGroupOpen(true)}>
          <Plus className="mr-2 size-4" />
          {t('createGroup')}
        </Button>
      </div>

      <Card variant="bordered" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {showInitialLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t('loading')}
            </div>
          ) : isError ? (
            <div className="flex h-40 items-center justify-center text-destructive">
              {t('error')}
            </div>
          ) : (
            <>
              {isFetching && !showInitialLoading ? (
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('loading')}
                </div>
              ) : null}
              <GroupTable
                groups={groupsData?.groups ?? []}
                onSelectGroup={handleSelectGroup}
              />
            </>
          )}
        </div>

        {!showInitialLoading && !isError ? (
          <DataTablePagination
            pagination={{
              pageIndex: safePage - 1,
              pageSize: currentLimit,
            }}
            pageCount={totalPages}
            total={total}
            pageSizeOptions={[...ADMIN_GROUPS_PAGE_SIZE_OPTIONS]}
            onPaginationChange={(pagination) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  page: pagination.pageIndex + 1,
                  limit: pagination.pageSize,
                }),
              })
            }}
          />
        ) : null}
      </Card>

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
      />
    </div>
  )
}
