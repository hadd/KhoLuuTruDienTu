import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { PlanPaperPlansFields } from '@/features/plan-management/components/PlanPaperPlansFields'
import { calculatePlanDaysFromRange } from '@/features/plan-management/lib/planStats'
import type { CreatePlanFormValues } from '@/features/plan-management/schemas'
import { FormField, type AppFormApi } from '@/lib/forms'

interface PlanCreateFormFieldsProps {
  form: AppFormApi<CreatePlanFormValues>
  lockProject?: boolean
}

function syncDateCountFromRange(
  form: AppFormApi<CreatePlanFormValues>,
  startDate: string,
  endDate: string,
) {
  if (!startDate || !endDate || endDate < startDate) {
    return
  }

  form.setFieldValue(
    'dateCount',
    calculatePlanDaysFromRange(startDate, endDate),
  )
}

export function PlanCreateFormFields({
  form,
  lockProject = false,
}: PlanCreateFormFieldsProps) {
  const { t } = useTranslation('plan-management')

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-4">
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

        <FormField
          form={form}
          name="dossierCount"
          label={t('form.fields.dossierCount.label')}
          placeholder={t('form.fields.dossierCount.placeholder')}
          as="number"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            form={form}
            name="startDate"
            label={t('form.fields.startDate.label')}
            placeholder={t('form.fields.startDate.placeholder')}
            as="date"
            render={(field) => (
              <Input
                type="date"
                className="w-full"
                value={field.state.value ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  field.handleChange(value)
                  syncDateCountFromRange(
                    form,
                    value,
                    form.state.values.endDate,
                  )
                }}
                onBlur={field.handleBlur}
              />
            )}
          />
          <FormField
            form={form}
            name="endDate"
            label={t('form.fields.endDate.label')}
            placeholder={t('form.fields.endDate.placeholder')}
            as="date"
            render={(field) => (
              <Input
                type="date"
                className="w-full"
                value={field.state.value ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  field.handleChange(value)
                  syncDateCountFromRange(
                    form,
                    form.state.values.startDate,
                    value,
                  )
                }}
                onBlur={field.handleBlur}
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-4">
        <PlanPaperPlansFields form={form} />

        <FormField
          form={form}
          name="dateCount"
          label={t('form.fields.dateCount.label')}
          placeholder={t('form.fields.dateCount.placeholder')}
          as="number"
          description={t('form.fields.dateCount.hint')}
        />
      </div>
    </div>
  )
}
