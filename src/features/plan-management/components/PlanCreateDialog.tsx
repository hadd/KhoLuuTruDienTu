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
import { buildCreatePlanPayload } from '@/features/plan-management/lib/planPayload'
import { useCreateProjectPlan } from '@/features/plan-management/queries'
import type { CreatePlanFormValues } from '@/features/plan-management/schemas'
import { createPlanSchema } from '@/features/plan-management/schemas'
import { FormField, useAppForm } from '@/lib/forms'

function createEmptyValues(projectCode = ''): CreatePlanFormValues {
  return {
    name: '',
    projectCode,
    a4Pages: 0,
    a3Pages: 0,
    dossierCount: 0,
    quota: '',
    startDate: '',
    endDate: '',
  }
}

interface PlanCreateFormProps {
  defaultProjectCode: string
  lockProject: boolean
  onClose: () => void
}

function PlanCreateForm({
  defaultProjectCode,
  lockProject,
  onClose,
}: PlanCreateFormProps) {
  const { t } = useTranslation('plan-management')
  const createPlan = useCreateProjectPlan()

  const form = useAppForm({
    schema: createPlanSchema,
    defaultValues: createEmptyValues(defaultProjectCode),
    onSubmit: async ({ value }) => {
      await createPlan.mutateAsync(buildCreatePlanPayload(value))
      onClose()
    },
  })

  return (
    <form
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

      {!lockProject && (
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
      )}

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
          disabled={createPlan.isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={createPlan.isPending}>
          {createPlan.isPending
            ? t('form.actions.saving')
            : t('form.actions.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface PlanCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectCode?: string
}

export function PlanCreateDialog({
  open,
  onOpenChange,
  defaultProjectCode = '',
}: PlanCreateDialogProps) {
  const { t } = useTranslation('plan-management')
  const lockProject = Boolean(defaultProjectCode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
        </DialogHeader>

        {open && (
          <PlanCreateForm
            key={defaultProjectCode || 'new'}
            defaultProjectCode={defaultProjectCode}
            lockProject={lockProject}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
