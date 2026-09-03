import { Check, Circle, Loader2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import {
  buildWorkflowSteps,
  resolveCurrentStepLabel,
} from '@/features/data-management/lib/workflowSteps'
import type {
  DataDossierStatus,
  DataDossierWorkflowAssignmentsT,
  DataWorkflowStepPhaseT,
  DataWorkflowStepT,
} from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

function phaseIcon(phase: DataWorkflowStepPhaseT) {
  switch (phase) {
    case 'completed':
      return <Check className="size-3.5" aria-hidden />
    case 'current':
      return <Loader2 className="size-3.5 animate-spin" aria-hidden />
    case 'rejected':
      return <X className="size-3.5" aria-hidden />
    default:
      return <Circle className="size-3.5" aria-hidden />
  }
}

function stepTitle(
  step: DataWorkflowStepT,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (step.kind === 'maker') return t('recordDetail.workflow.stepMaker')
  if (step.kind === 'approved') return t('recordDetail.workflow.stepApproved')
  if (step.totalCheckers === 1) {
    return t('recordDetail.workflow.stepCheckerSingle')
  }
  return t('recordDetail.workflow.stepChecker', { level: step.level ?? 1 })
}

function phaseLabel(
  phase: DataWorkflowStepPhaseT,
  t: (key: string) => string,
): string {
  return t(`recordDetail.workflow.phase.${phase}`)
}

function assignmentStatusLabel(
  status: string,
  t: (key: string) => string,
): string {
  const key = `recordDetail.workflow.assignmentStatus.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}

export function RecordWorkflowSection({
  data,
  isLoading,
  isError,
}: {
  data: DataDossierWorkflowAssignmentsT | undefined
  isLoading: boolean
  isError: boolean
}) {
  const { t } = useTranslation('data-management')

  const steps = useMemo(
    () => (data ? buildWorkflowSteps(data) : []),
    [data],
  )

  const currentLabel = useMemo(
    () => resolveCurrentStepLabel(steps, t),
    [steps, t],
  )

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('recordDetail.workflow.loading')}
      </p>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('recordDetail.workflow.loadError')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {t('recordDetail.workflow.title')}
          </h3>
          <DossierStatusBadge status={data.status as DataDossierStatus} />
        </div>
        <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">
              {t('recordDetail.workflow.requiredSteps')}
            </dt>
            <dd className="font-medium text-foreground">
              {t('recordDetail.workflow.requiredStepsValue', {
                count: data.requiredQcCount,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t('recordDetail.workflow.currentStep')}
            </dt>
            <dd className="font-medium text-foreground">{currentLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t('recordDetail.workflow.completedQc')}
            </dt>
            <dd className="font-medium text-foreground">
              {t('recordDetail.workflow.completedQcValue', {
                current: data.currentQcStep,
                total: data.requiredQcCount,
              })}
            </dd>
          </div>
        </dl>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('recordDetail.workflow.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map((step) => {
            const isCurrent = step.phase === 'current'
            return (
              <li
                key={step.key}
                className={cn(
                  'rounded-md border border-border p-3',
                  isCurrent && 'border-primary bg-primary/5',
                  step.phase === 'rejected' &&
                    'border-destructive/40 bg-destructive/5',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border',
                        step.phase === 'completed' &&
                          'border-emerald-600/40 bg-emerald-500/10 text-emerald-700',
                        step.phase === 'current' &&
                          'border-primary/40 bg-primary/10 text-primary',
                        step.phase === 'rejected' &&
                          'border-destructive/40 bg-destructive/10 text-destructive',
                        step.phase === 'pending' &&
                          'border-border text-muted-foreground',
                      )}
                    >
                      {phaseIcon(step.phase)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {stepTitle(step, t)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {phaseLabel(step.phase, t)}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {t('recordDetail.workflow.currentBadge')}
                    </Badge>
                  ) : null}
                </div>

                {step.kind !== 'approved' ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {step.assignees.length > 0 ? (
                      step.assignees.map((person) => (
                        <Badge
                          key={person.id}
                          variant="secondary"
                          className="max-w-full truncate"
                          title={`${person.name} (${assignmentStatusLabel(person.status, t)})`}
                        >
                          {person.name}
                          <span className="ml-1 font-normal text-muted-foreground">
                            · {assignmentStatusLabel(person.status, t)}
                          </span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t('recordDetail.workflow.unassigned')}
                      </span>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
