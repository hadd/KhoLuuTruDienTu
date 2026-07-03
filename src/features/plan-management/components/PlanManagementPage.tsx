import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { PlanCreateDialog } from '@/features/plan-management/components/PlanCreateDialog'
import { PlanDeleteDialog } from '@/features/plan-management/components/PlanDeleteDialog'
import { PlanEditDialog } from '@/features/plan-management/components/PlanEditDialog'
import { usePlanManagementProjectSelection } from '@/features/plan-management/hooks/usePlanManagementProjectSelection'
import {
  DEFAULT_PLANS_LIMIT,
  projectPlansQueryOptions,
} from '@/features/plan-management/queries'
import type { ProjectPlanT } from '@/features/plan-management/types'

const routeApi = getRouteApi('/app/plan-management/')

function toTableRow(plan: ProjectPlanT): Row<ProjectPlanT> {
  return { original: plan } as Row<ProjectPlanT>
}

export function PlanManagementPage() {
  const { t } = useTranslation('plan-management')
  const search = routeApi.useSearch()
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

  const limit = search.limit ?? DEFAULT_PLANS_LIMIT
  const offset = search.offset ?? 0

  const { data, isLoading, isError } = useQuery(
    projectPlansQueryOptions({
      projectCode,
      viewAll,
      limit,
      offset,
    }),
  )

  const plans = data?.items ?? []

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

  if (!viewAll && !projectCode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <PlanFilterBar
          projectCode={projectCode}
          onProjectChange={handleProjectChange}
          onViewAll={handleViewAllProjects}
          onAddPlan={() => setCreateOpen(true)}
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <PlanFilterBar
        projectCode={projectCode}
        onProjectChange={handleProjectChange}
        onViewAll={handleViewAllProjects}
        onAddPlan={() => setCreateOpen(true)}
        viewAllActive={viewAll}
      />

      <Card
        variant="list"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {t('list.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewAll ? t('list.descriptionAll') : t('list.description')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        variant="ghost"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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
  onProjectChange: (projectCode: string) => void
  onViewAll: () => void
  onAddPlan: () => void
  viewAllActive?: boolean
}

function PlanFilterBar({
  projectCode,
  onProjectChange,
  onViewAll,
  onAddPlan,
  viewAllActive = false,
}: PlanFilterBarProps) {
  const { t } = useTranslation('plan-management')

  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {t('project.selectLabel')}
          </Label>
          <ProjectSelect
            className="w-full min-w-[200px] sm:w-64"
            value={projectCode}
            onValueChange={onProjectChange}
          />
        </div>
        <Button
          type="button"
          variant={viewAllActive ? 'default' : 'outline'}
          onClick={onViewAll}
        >
          {t('project.viewAll')}
        </Button>
      </div>
      <Button type="button" onClick={onAddPlan}>
        <Plus className="size-4" />
        {t('actions.addPlan')}
      </Button>
    </div>
  )
}
