import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Save,
  Timer,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { sumPlanDetailQuantities } from '@/features/plan-management/lib/planStats'
import {
  projectPlanDetailsQueryOptions,
  projectPlanQueryOptions,
  useUpdateProjectPlanDetails,
} from '@/features/plan-management/queries'
import type { ProjectPlanDetailItemT } from '@/features/plan-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/format'

const routeApi = getRouteApi('/app/plan-management/$planId')

interface EditableTaskRow {
  rowKey: string
  taskName: string
  quantity: number
  unit: string
  quota: number
  dateCount: number
  workerCount: number
}

function toEditableTaskRow(item: ProjectPlanDetailItemT): EditableTaskRow {
  return {
    rowKey: item.id,
    taskName: item.taskName,
    quantity: item.quantity,
    unit: item.unit,
    quota: item.quota,
    dateCount: item.dateCount,
    workerCount: item.workerCount,
  }
}

function createEmptyTaskRow(seed = Date.now()): EditableTaskRow {
  return {
    rowKey: `new-${seed}`,
    taskName: '',
    quantity: 0,
    unit: '',
    quota: 0,
    dateCount: 0,
    workerCount: 0,
  }
}

export function PlanDetailPage() {
  const { t } = useTranslation('plan-management')
  const language = useCurrentLanguage()
  const { planId } = routeApi.useParams()
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()

  const numberLocale = language === 'vi' ? 'vi-VN' : 'en-US'

  const {
    data: plan,
    isLoading: isPlanLoading,
    isError: isPlanError,
  } = useQuery(projectPlanQueryOptions(planId))

  const {
    data: detailItems = [],
    isLoading: isDetailsLoading,
    isError: isDetailsError,
  } = useQuery(projectPlanDetailsQueryOptions(planId))
  const updatePlanDetails = useUpdateProjectPlanDetails()
  const [taskRows, setTaskRows] = useState<Array<EditableTaskRow>>([])
  const [isEditing, setIsEditing] = useState(false)

  const isLoading = isPlanLoading || isDetailsLoading
  const isError = isPlanError || isDetailsError
  const isSaving = updatePlanDetails.isPending

  useEffect(() => {
    setTaskRows(
      detailItems.length > 0 ? detailItems.map(toEditableTaskRow) : [],
    )
    setIsEditing(false)
  }, [detailItems])

  const handleStartEditing = () => {
    setTaskRows((prev) => (prev.length > 0 ? prev : [createEmptyTaskRow()]))
    setIsEditing(true)
  }

  const totalQuantity = useMemo(
    () =>
      sumPlanDetailQuantities(
        taskRows.map((row) => ({
          id: row.rowKey,
          planId,
          taskName: row.taskName,
          quantity: row.quantity,
          unit: row.unit,
          quota: row.quota,
          dateCount: row.dateCount,
          workerCount: row.workerCount,
          createdAt: '',
          updatedAt: '',
        })),
      ),
    [planId, taskRows],
  )

  const handleBack = () => {
    void navigate({
      to: '/app/plan-management/',
      search,
    })
  }

  const handleAddTask = () => {
    setTaskRows((prev) => [...prev, createEmptyTaskRow()])
  }

  const handleRemoveTask = (rowKey: string) => {
    setTaskRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.rowKey !== rowKey),
    )
  }

  const updateTaskRow = (
    rowKey: string,
    patch: Partial<Omit<EditableTaskRow, 'rowKey'>>,
  ) => {
    setTaskRows((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)),
    )
  }

  const handleSaveTasks = async () => {
    const sanitizedRows = taskRows
      .map((row) => ({
        taskName: row.taskName.trim(),
        quantity: row.quantity,
        unit: row.unit.trim(),
        quota: row.quota,
        dateCount: row.dateCount,
        workerCount: row.workerCount,
      }))
      .filter(
        (row) =>
          row.taskName ||
          row.unit ||
          row.quantity > 0 ||
          row.quota > 0 ||
          row.dateCount > 0 ||
          row.workerCount > 0,
      )

    await updatePlanDetails.mutateAsync({
      planId,
      payload: {
        details: sanitizedRows,
      },
    })
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">{t('errors.detailFailed')}</p>
        <Button type="button" variant="outline" onClick={handleBack}>
          {t('detail.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-start gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0"
          onClick={handleBack}
          aria-label={t('detail.back')}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">
            {t('detail.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('detail.subtitle')}
          </p>
        </div>
      </div>

      <Card variant="detail" className="p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryField
            icon={FileText}
            label={t('detail.summary.name')}
            value={plan.name}
          />
          <SummaryField
            icon={FileText}
            label={t('detail.summary.totalPages')}
            value={formatNumber(totalQuantity, {
              locale: numberLocale,
              maximumFractionDigits: 0,
            })}
          />
          <SummaryField
            icon={Timer}
            label={t('detail.summary.totalDuration')}
            value={t('units.days', { count: plan.dateCount })}
          />
          <SummaryField
            icon={Gauge}
            label={t('detail.summary.totalDossiers')}
            value={formatNumber(plan.dossierCount, {
              locale: numberLocale,
              maximumFractionDigits: 0,
            })}
          />
          <SummaryField
            icon={FolderKanban}
            label={t('detail.summary.project')}
            value={plan.project.projectName}
          />
        </div>
      </Card>

      <Card variant="list" className="overflow-hidden">
        <div className="flex items-center justify-end gap-2 border-b border-border p-4">
          {isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={handleAddTask}>
                <Plus className="size-4" />
                {t('detail.actions.addTask')}
              </Button>
              <Button type="button" onClick={handleSaveTasks} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {isSaving ? t('detail.actions.saving') : t('detail.actions.save')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleStartEditing}>
              <Pencil className="size-4" />
              {t('actions.edit')}
            </Button>
          )}
        </div>
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[11%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-accent/40 hover:bg-accent/40">
              <TableHead className="text-center">
                {t('detail.table.columns.taskName')}
              </TableHead>
              <TableHead className="text-center">
                {t('detail.table.columns.quantity')}
              </TableHead>
              <TableHead className="text-center">
                {t('detail.table.columns.quota')}
              </TableHead>
              <TableHead className="text-center">
                {t('detail.table.columns.workerCount')}
              </TableHead>
              <TableHead className="text-center">
                {t('detail.table.columns.unit')}
              </TableHead>
              <TableHead className="text-center">
                {t('detail.table.columns.duration')}
              </TableHead>
              {isEditing ? (
                <TableHead className="text-center">
                  {t('detail.table.columns.actions')}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isEditing ? 7 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('detail.emptyTasks')}
                </TableCell>
              </TableRow>
            ) : (
              taskRows.map((item) => (
                <TableRow key={item.rowKey}>
                  <TableCell className="text-center font-medium">
                    {isEditing ? (
                      <Input
                        value={item.taskName}
                        placeholder={t('detail.form.taskName.placeholder')}
                        onChange={(event) =>
                          updateTaskRow(item.rowKey, {
                            taskName: event.target.value,
                          })
                        }
                      />
                    ) : (
                      item.taskName || '—'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity === 0 ? '' : String(item.quantity)}
                        placeholder={t('detail.form.quantity.placeholder')}
                        onChange={(event) => {
                          const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                          updateTaskRow(item.rowKey, {
                            quantity: nextRaw ? Number(nextRaw) : 0,
                          })
                        }}
                      />
                    ) : (
                      formatNumber(item.quantity, {
                        locale: numberLocale,
                        maximumFractionDigits: 0,
                      })
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quota === 0 ? '' : String(item.quota)}
                        placeholder={t('detail.form.quota.placeholder')}
                        onChange={(event) => {
                          const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                          updateTaskRow(item.rowKey, {
                            quota: nextRaw ? Number(nextRaw) : 0,
                          })
                        }}
                      />
                    ) : (
                      formatNumber(item.quota, {
                        locale: numberLocale,
                        maximumFractionDigits: 0,
                      })
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={
                          item.workerCount === 0 ? '' : String(item.workerCount)
                        }
                        placeholder={t('detail.form.workerCount.placeholder')}
                        onChange={(event) => {
                          const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                          updateTaskRow(item.rowKey, {
                            workerCount: nextRaw ? Number(nextRaw) : 0,
                          })
                        }}
                      />
                    ) : (
                      formatNumber(item.workerCount, {
                        locale: numberLocale,
                        maximumFractionDigits: 0,
                      })
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        value={item.unit}
                        placeholder={t('detail.form.unit.placeholder')}
                        onChange={(event) =>
                          updateTaskRow(item.rowKey, { unit: event.target.value })
                        }
                      />
                    ) : (
                      item.unit || '—'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.dateCount === 0 ? '' : String(item.dateCount)}
                        placeholder={t('detail.form.dateCount.placeholder')}
                        onChange={(event) => {
                          const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                          updateTaskRow(item.rowKey, {
                            dateCount: nextRaw ? Number(nextRaw) : 0,
                          })
                        }}
                      />
                    ) : (
                      t('units.days', { count: item.dateCount })
                    )}
                  </TableCell>
                  {isEditing ? (
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'text-destructive hover:text-destructive',
                          taskRows.length <= 1 && 'invisible',
                        )}
                        disabled={taskRows.length <= 1}
                        onClick={() => handleRemoveTask(item.rowKey)}
                        aria-label={t('detail.actions.removeTask')}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function SummaryField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/60 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-base font-semibold text-foreground">
          <TextBlock lines={2}>{value}</TextBlock>
        </p>
      </div>
    </div>
  )
}
