import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildProjectPayload,
} from '@/features/project-manager/lib/projectPayload'
import { useCreateProject } from '@/features/project-manager/queries'
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
  type ProjectFormValues,
} from '@/features/project-manager/schemas'
import { FormField, useAppForm } from '@/lib/forms'

const emptyValues: ProjectFormValues = {
  projectCode: '',
  projectName: '',
  projectType: '',
  investor: '',
  startDate: '',
  acceptanceDate: '',
  totalInvestment: '',
  status: 'IN_PROGRESS',
}

interface ProjectCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectCreateDialog({
  open,
  onOpenChange,
}: ProjectCreateDialogProps) {
  const { t } = useTranslation('project-manager')
  const createProject = useCreateProject()

  const form = useAppForm({
    schema: projectFormSchema,
    defaultValues: emptyValues,
    onSubmit: async ({ value }) => {
      await createProject.mutateAsync(buildProjectPayload(value))
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
        </DialogHeader>

        <form
          key={open ? 'open' : 'closed'}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <FormField
            form={form}
            name="projectCode"
            label={t('form.fields.projectCode.label')}
            placeholder={t('form.fields.projectCode.placeholder')}
          />
          <FormField
            form={form}
            name="projectName"
            label={t('form.fields.projectName.label')}
            placeholder={t('form.fields.projectName.placeholder')}
          />
          <FormField
            form={form}
            name="projectType"
            label={t('form.fields.projectType.label')}
            placeholder={t('form.fields.projectType.placeholder')}
          />
          <FormField
            form={form}
            name="investor"
            label={t('form.fields.investor.label')}
            placeholder={t('form.fields.investor.placeholder')}
          />
          <FormField
            form={form}
            name="startDate"
            label={t('form.fields.startDate.label')}
            placeholder={t('form.fields.startDate.placeholder')}
            as="date"
          />
          <FormField
            form={form}
            name="acceptanceDate"
            label={t('form.fields.acceptanceDate.label')}
            placeholder={t('form.fields.acceptanceDate.placeholder')}
            as="date"
          />
          <FormField
            form={form}
            name="totalInvestment"
            label={t('form.fields.totalInvestment.label')}
            placeholder={t('form.fields.totalInvestment.placeholder')}
          />
          <FormField
            form={form}
            name="status"
            label={t('form.fields.status.label')}
            render={(field) => (
              <Select
                value={field.state.value}
                onValueChange={field.handleChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('form.fields.status.placeholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_VALUES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createProject.isPending}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending
                ? t('form.actions.saving')
                : t('form.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
