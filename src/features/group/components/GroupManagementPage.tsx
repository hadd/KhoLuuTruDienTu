import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreateGroupDialog } from '@/features/group/components/CreateGroupDialog'
import { GroupTable } from '@/features/group/components/GroupTable'
import { useGroupAccess } from '@/features/group/hooks/useGroupAccess'
import {
  adminGroupsQueryOptions,
  DEFAULT_ADMIN_GROUPS_LIMIT,
} from '@/features/group/queries'
import { ProjectSectionTabs } from '@/features/project-management/components/ProjectSectionTabs'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/groups/')

export function GroupManagementPage() {
  const { t } = useTranslation('group')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const { canCreateGroup } = useGroupAccess()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_ADMIN_GROUPS_LIMIT

  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const { data, isLoading, isFetching, isError } = useQuery(
    adminGroupsQueryOptions({
      page,
      limit,
      search: q.trim() ? q.trim() : undefined,
    }),
  )

  const groups = data?.groups ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    if (isLoading || isFetching || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, isLoading, isFetching, data])

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

  const handleSelectGroup = (groupId: string) => {
    void navigate({
      to: '/app/groups/$groupId',
      params: { groupId },
      search: (prev) => prev,
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">{t('error')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <ProjectSectionTabs active="groups" compact />

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListPageSearchInput
          className="w-full sm:max-w-md"
          value={inputValue}
          onChange={setInputValue}
          onSearch={submitSearch}
          placeholder={t('search')}
          aria-label={t('search')}
        />
        {canCreateGroup ? (
          <Button
            type="button"
            onClick={() => setCreateGroupOpen(true)}
            className="shrink-0 self-end sm:self-auto"
          >
            <Plus className="size-4" />
            {t('createGroup')}
          </Button>
        ) : null}
      </div>

      <Card
        variant="list"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <GroupTable groups={groups} onSelectGroup={handleSelectGroup} />
        </div>
      </Card>

      <div className="shrink-0">
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
      </div>

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
      />
    </div>
  )
}
