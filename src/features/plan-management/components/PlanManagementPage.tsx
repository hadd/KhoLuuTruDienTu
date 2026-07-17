import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'
import { SectionPageHeader } from '@/features/navigation/components/SectionBackNav'
import { PlanCreateDialog } from '@/features/plan-management/components/PlanCreateDialog'
import { PlanDeleteDialog } from '@/features/plan-management/components/PlanDeleteDialog'
import { PlanEditDialog } from '@/features/plan-management/components/PlanEditDialog'
import { usePlanManagementProjectSelection } from '@/features/plan-management/hooks/usePlanManagementProjectSelection'
import { usePlanAccess } from '@/features/plan-management/hooks/usePlanAccess'
import {
  DEFAULT_PLANS_LIMIT,
  projectPlansQueryOptions,
} from '@/features/plan-management/queries'
import type { PlanSearchT } from '@/features/plan-management/schemas'
import type { ProjectPlanT } from '@/features/plan-management/types'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/plan-management/')

function toTableRow(plan: ProjectPlanT): Row<ProjectPlanT> {
  return { original: plan } as Row<ProjectPlanT>
}

export function PlanManagementPage() {
  const { t } = useTranslation('plan-management')
  const search: PlanSearchT = routeApi.useSearch()
  const {
    projectCode,
    viewAll,
    handleProjectChange,
    handleViewAllProjects,
  } = usePlanManagementProjectSelection()
  const navigate = routeApi.useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [deletePlan, setDeletePlan] = useState<ProjectPlanT | null>(null)
  const {
    canCreateProjectPlans,
    canUpdateProjectPlans,
    canDeleteProjectPlans,
  } = usePlanAccess()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PLANS_LIMIT

  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const { data, isLoading, isFetching, isError } = useQuery(
    projectPlansQueryOptions({
      projectCode,
      viewAll,
      search: q.trim() ? q.trim() : undefined,
      limit,
      page,
    }),
  )

  const plans = data?.items ?? []
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

  const handleView = (plan: ProjectPlanT) => {
    void navigate({
      to: '/app/plan-management/$planId',
      params: { planId: plan.id },
      search: (prev) => prev,
    })
  }

  const handleEdit = (plan: ProjectPlanT) => {
    setEditPlanId(plan.id)
    setEditOpen(true)
  }

  const handleDelete = (plan: ProjectPlanT) => {
    setDeletePlan(plan)
    setDeleteOpen(true)
  }

  if (!projectCode && !viewAll) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <SectionPageHeader
          currentLabel={t('title')}
          description={t('description')}
        />
        <PlanFilterBar
          projectCode={projectCode}
          viewAllActive={viewAll}
          onProjectChange={handleProjectChange}
          onViewAll={handleViewAllProjects}
          onAddPlan={() => setCreateOpen(true)}
          canCreate={canCreateProjectPlans}
          searchValue={inputValue}
          onSearchChange={setInputValue}
          onSearch={submitSearch}
        />
        <Card variant="bordered" className="flex max-w-lg flex-col gap-3 p-6">
          <p className="text-sm text-muted-foreground">
            {t('project.selectPrompt')}
          </p>
        </Card>
      </div>
    )
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
        <p className="text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <SectionPageHeader
        currentLabel={t('title')}
        description={t('description')}
      />
      <PlanFilterBar
        projectCode={projectCode}
        viewAllActive={viewAll}
        onProjectChange={handleProjectChange}
        onViewAll={handleViewAllProjects}
        onAddPlan={() => setCreateOpen(true)}
        canCreate={canCreateProjectPlans}
        searchValue={inputValue}
        onSearchChange={setInputValue}
        onSearch={submitSearch}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/50 [&_th]:bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                <TableHead>{t('table.columns.name')}</TableHead>
                <TableHead>{t('table.columns.project')}</TableHead>
                <TableHead>{t('table.columns.duration')}</TableHead>
                <TableHead className="text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow
                    key={plan.id}
                    className="cursor-pointer"
                    onClick={() => handleView(plan)}
                  >
                    <TableCell className="font-medium">
                      <TextBlock lines={1}>{plan.name}</TextBlock>
                    </TableCell>
                    <TableCell>
                      <TextBlock lines={1} className="text-muted-foreground">
                        {plan.project.projectName}
                      </TextBlock>
                    </TableCell>
                    <TableCell>
                      {t('units.days', { count: plan.dateCount })}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DataTableRowActions
                        row={toTableRow(plan)}
                        onView={handleView}
                        onEdit={canUpdateProjectPlans ? handleEdit : undefined}
                        onDelete={canDeleteProjectPlans ? handleDelete : undefined}
                        variant="ghost"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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

      <PlanEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        planId={editPlanId}
      />

      <PlanDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        plan={deletePlan}
      />

      <PlanCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectCode={projectCode ?? ''}
      />
    </div>
  )
}

type PlanFilterBarProps = {
  projectCode?: string
  viewAllActive?: boolean
  onProjectChange: (projectCode: string) => void
  onViewAll: () => void
  onAddPlan: () => void
  canCreate?: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onSearch: () => void
}

function PlanFilterBar({
  projectCode,
  viewAllActive = false,
  onProjectChange,
  onViewAll,
  onAddPlan,
  canCreate = false,
  searchValue,
  onSearchChange,
  onSearch,
}: PlanFilterBarProps) {
  const { t } = useTranslation('plan-management')

  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <ListPageSearchInput
          value={searchValue}
          onChange={onSearchChange}
          onSearch={onSearch}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
        />
        <ProjectSelect
          className="w-full sm:w-64"
          value={viewAllActive ? ALL_PROJECTS_CODE : projectCode}
          onValueChange={(nextValue) => {
            if (nextValue === ALL_PROJECTS_CODE) {
              onViewAll()
            } else {
              onProjectChange(nextValue)
            }
          }}
          allOptionLabel={t('project.viewAll')}
        />
      </div>
      <Button
        type="button"
        className="shrink-0"
        onClick={onAddPlan}
        disabled={!canCreate}
      >
        <Plus className="size-4" />
        {t('actions.addPlan')}
      </Button>
    </div>
  )
}
