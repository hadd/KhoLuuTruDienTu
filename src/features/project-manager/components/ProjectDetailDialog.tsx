import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProjectStatusBadge } from '@/features/project-manager/components/ProjectStatusBadge'
import {
  projectDetailQueryOptions,
  projectProgressHistoryQueryOptions,
} from '@/features/project-manager/queries'
import { formatProjectManagerName } from '@/features/project-manager/lib/normalizeProject'
import type {
  ProjectProgressHistoryT,
  ProjectT,
} from '@/features/project-manager/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/format'

interface ProjectDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 border-b border-border py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

function formatInvestment(value: string | null): string {
  if (!value) return '—'
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return value
  return formatCurrency(parsed)
}

function formatOptionalDate(value: string | null, locale: 'en' | 'vi'): string {
  if (!value) return '—'
  return formatDate(value, 'PP', locale)
}

function ProjectProgressHistoryList({
  items,
  isLoading,
  isError,
}: {
  items: Array<ProjectProgressHistoryT>
  isLoading: boolean
  isError: boolean
}) {
  const { t } = useTranslation('project-manager')
  const locale = useCurrentLanguage()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('errors.historyFailed')}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('detail.history.empty')}
      </p>
    )
  }

  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )

  return (
    <div className="flex flex-col gap-3">
      {sortedItems.map((entry) => (
        <Card key={entry.id} variant="bordered" className="p-4">
          <dl className="space-y-2">
            <DetailRow
              label={t('detail.history.extensionNumber')}
              value={entry.extensionNumber}
            />
            <DetailRow
              label={t('detail.history.previousAcceptanceDate')}
              value={formatOptionalDate(entry.previousAcceptanceDate, locale)}
            />
            <DetailRow
              label={t('detail.history.newAcceptanceDate')}
              value={formatOptionalDate(entry.newAcceptanceDate, locale)}
            />
            <DetailRow
              label={t('detail.history.changeReason')}
              value={entry.changeReason || '—'}
            />
          </dl>
        </Card>
      ))}
    </div>
  )
}

function ProjectDetailContent({
  project,
  projectId,
}: {
  project: ProjectT
  projectId: string
}) {
  const { t } = useTranslation('project-manager')
  const locale = useCurrentLanguage()

  const {
    data: history = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useQuery({
    ...projectProgressHistoryQueryOptions(projectId),
    enabled: Boolean(projectId),
  })

  return (
    <div className="flex max-h-[min(75vh,44rem)] flex-col gap-6 overflow-y-auto pr-1">
      <dl className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <div className="grid grid-cols-1 gap-4 border-b border-border pb-4 sm:grid-cols-2">
          <DetailField
            label={t('table.columns.projectCode')}
            value={<span className="font-medium">{project.projectCode}</span>}
          />
          <DetailField
            label={t('table.columns.projectName')}
            value={project.projectName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailField
            label={t('table.columns.projectType')}
            value={project.projectType}
          />
          <DetailField
            label={t('table.columns.investor')}
            value={project.investor}
          />
          <DetailField
            label={t('table.columns.manager')}
            value={formatProjectManagerName(project)}
          />
          <DetailField
            label={t('form.fields.startDate.label')}
            value={formatOptionalDate(project.startDate, locale)}
          />
          <DetailField
            label={t('form.fields.acceptanceDate.label')}
            value={formatOptionalDate(project.acceptanceDate, locale)}
          />
          <DetailField
            label={t('form.fields.totalInvestment.label')}
            value={formatInvestment(project.totalInvestment)}
          />
          <DetailField
            label={t('table.columns.status')}
            value={<ProjectStatusBadge status={project.status} />}
          />
        </div>
      </dl>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('detail.history.title')}
        </h3>
        <ProjectProgressHistoryList
          items={history}
          isLoading={isHistoryLoading}
          isError={isHistoryError}
        />
      </section>
    </div>
  )
}

export function ProjectDetailDialog({
  open,
  onOpenChange,
  projectId,
}: ProjectDetailDialogProps) {
  const { t } = useTranslation('project-manager')

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery({
    ...projectDetailQueryOptions(projectId ?? ''),
    enabled: open && Boolean(projectId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('detail.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !project || !projectId ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('errors.detailFailed')}
          </p>
        ) : (
          <ProjectDetailContent project={project} projectId={projectId} />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
