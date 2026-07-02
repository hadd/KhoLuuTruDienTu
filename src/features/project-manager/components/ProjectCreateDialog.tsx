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
import { useAuthStore, useCurrentUserRole } from '@/features/auth/store'
import { ProjectManagerSelect } from '@/features/project-manager/components/ProjectManagerSelect'
import { buildProjectPayload } from '@/features/project-manager/lib/projectPayload'
import { useCreateProject } from '@/features/project-manager/queries'
import type { ProjectFormValues } from '@/features/project-manager/schemas'
import {
  PROJECT_STATUS_VALUES,
  projectFormSchema,
} from '@/features/project-manager/schemas'
import { FormField, useAppForm } from '@/lib/forms'

function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10)
}

function createEmptyValues(defaultManagerId = ''): ProjectFormValues {
  const todayDate = getTodayDateValue()

  return {
    projectCode: '',
    projectName: '',
    projectType: '',
    investor: '',
    startDate: todayDate,
    acceptanceDate: '',
    changeReason: '',
    totalInvestment: '',
    status: 'IN_PROGRESS',
    managerId: defaultManagerId,
  }
}

interface ProjectCreateFormProps {
  onClose: () => void
  defaultManagerId?: string
}

function ProjectCreateForm({
  onClose,
  defaultManagerId = '',
}: ProjectCreateFormProps) {
  const { t } = useTranslation('project-manager')
  const createProject = useCreateProject()

  const form = useAppForm({
    schema: projectFormSchema,
    defaultValues: createEmptyValues(defaultManagerId),
    onSubmit: async ({ value }) => {
      await createProject.mutateAsync(buildProjectPayload(value))
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              name="managerId"
              label={t('form.fields.managerId.label')}
              render={(field) => (
                <ProjectManagerSelect
                  value={field.state.value}
                  onValueChange={field.handleChange}
                />
              )}
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
          </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
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
  )
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
  const currentUser = useAuthStore((state) => state.user)
  const currentUserRole = useCurrentUserRole()
  const roleCode = (
    currentUserRole?.roleId ??
    currentUserRole?.role.id ??
    currentUserRole?.role.name ??
    ''
  )
    .toLowerCase()
    .trim()
  const isAdmin = roleCode === 'admin'
  const defaultManagerId = !isAdmin ? (currentUser?.id ?? '') : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
        </DialogHeader>

        {open && (
          <ProjectCreateForm
            key={`${defaultManagerId || 'create'}-${isAdmin ? 'admin' : 'non-admin'}`}
            defaultManagerId={defaultManagerId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
