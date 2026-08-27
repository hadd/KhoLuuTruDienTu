import { Check, Circle, Loader2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-2xl border border-border/80 bg-card/50 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-base font-semibold text-foreground">
            {t('recordDetail.workflow.title')}
          </h3>
          <DossierStatusBadge status={data.status as DataDossierStatus} />
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">
              {t('recordDetail.workflow.requiredSteps')}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">
              {t('recordDetail.workflow.requiredStepsValue', {
                count: data.requiredQcCount,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t('recordDetail.workflow.currentStep')}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{currentLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {t('recordDetail.workflow.completedQc')}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">
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
        <ol className="flex flex-col gap-3">
          {steps.map((step) => {
            const isCurrent = step.phase === 'current'
            return (
              <li
                key={step.key}
                className={cn(
                  'rounded-2xl border p-4 transition-all',
                  isCurrent
                    ? 'border-blue-500/80 bg-blue-50/40 shadow-xs'
                    : 'border-border/80 bg-card',
                  step.phase === 'rejected' &&
                    'border-destructive/50 bg-destructive/5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        step.phase === 'completed' &&
                          'border-emerald-500 bg-emerald-50 text-emerald-600',
                        step.phase === 'current' &&
                          'border-blue-500 bg-blue-100 text-blue-600',
                        step.phase === 'rejected' &&
                          'border-destructive bg-destructive/10 text-destructive',
                        step.phase === 'pending' &&
                          'border-muted-foreground/30 bg-transparent text-muted-foreground/40',
                      )}
                    >
                      {phaseIcon(step.phase)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground leading-tight">
                        {stepTitle(step, t)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {phaseLabel(step.phase, t)}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                      {t('recordDetail.workflow.currentBadge')}
                    </span>
                  ) : null}
                </div>

                {step.kind !== 'approved' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.assignees.length > 0 ? (
                      step.assignees.map((person) => (
                        <span
                          key={person.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium',
                            isCurrent
                              ? 'bg-blue-100/70 text-blue-950'
                              : 'bg-secondary text-secondary-foreground',
                          )}
                          title={`${person.name} (${assignmentStatusLabel(person.status, t)})`}
                        >
                          <span className="font-semibold">{person.name}</span>
                          <span className="text-muted-foreground">
                            · {assignmentStatusLabel(person.status, t)}
                          </span>
                        </span>
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
