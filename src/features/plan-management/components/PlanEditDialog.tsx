import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import {
  buildUpdatePlanPayload,
  planToFormValues,
} from '@/features/plan-management/lib/planPayload'
import {
  projectPlanQueryOptions,
  useUpdateProjectPlan,
} from '@/features/plan-management/queries'
import { updatePlanSchema } from '@/features/plan-management/schemas'
import type { ProjectPlanT } from '@/features/plan-management/types'
import { FormField, useAppForm } from '@/lib/forms'

interface PlanEditFormProps {
  plan: ProjectPlanT
  onClose: () => void
}

function PlanEditForm({ plan, onClose }: PlanEditFormProps) {
  const { t } = useTranslation('plan-management')
  const updatePlan = useUpdateProjectPlan()

  const form = useAppForm({
    schema: updatePlanSchema,
    defaultValues: planToFormValues(plan),
    onSubmit: async ({ value }) => {
      await updatePlan.mutateAsync({
        id: plan.id,
        payload: buildUpdatePlanPayload(value),
      })
      onClose()
    },
  })

  return (
    <form
      key={plan.id}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <FormField
        form={form}
        name="name"
        label={t('form.fields.name.label')}
        placeholder={t('form.fields.name.placeholder')}
      />

      <FormField
        form={form}
        name="projectCode"
        label={t('form.fields.projectCode.label')}
        render={(field) => (
          <ProjectSelect
            className="w-full"
            value={field.state.value}
            onValueChange={field.handleChange}
          />
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          form={form}
          name="a4Pages"
          label={t('form.fields.a4Pages.label')}
          placeholder={t('form.fields.a4Pages.placeholder')}
          as="number"
        />
        <FormField
          form={form}
          name="a3Pages"
          label={t('form.fields.a3Pages.label')}
          placeholder={t('form.fields.a3Pages.placeholder')}
          as="number"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          form={form}
          name="dossierCount"
          label={t('form.fields.dossierCount.label')}
          placeholder={t('form.fields.dossierCount.placeholder')}
          as="number"
        />
        <FormField
          form={form}
          name="quota"
          label={t('form.fields.quota.label')}
          placeholder={t('form.fields.quota.placeholder')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          form={form}
          name="startDate"
          label={t('form.fields.startDate.label')}
          placeholder={t('form.fields.startDate.placeholder')}
          as="date"
        />
        <FormField
          form={form}
          name="endDate"
          label={t('form.fields.endDate.label')}
          placeholder={t('form.fields.endDate.placeholder')}
          as="date"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updatePlan.isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={updatePlan.isPending}>
          {updatePlan.isPending
            ? t('form.actions.saving')
            : t('form.actions.update')}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface PlanEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string | null
}

export function PlanEditDialog({
  open,
  onOpenChange,
  planId,
}: PlanEditDialogProps) {
  const { t } = useTranslation('plan-management')

  const { data: plan, isLoading, isError } = useQuery({
    ...projectPlanQueryOptions(planId ?? ''),
    enabled: open && Boolean(planId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.editTitle')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !plan ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('errors.detailFailed')}
          </p>
        ) : (
          <PlanEditForm plan={plan} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
