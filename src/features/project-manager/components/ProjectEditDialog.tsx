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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectManagerSelect } from '@/features/project-manager/components/ProjectManagerSelect'
import {
  buildProjectPayload,
  projectToFormValues,
} from '@/features/project-manager/lib/projectPayload'
import { getProjectFormKey, mergeProjectData } from '@/features/project-manager/lib/normalizeProject'
import {
  projectDetailQueryOptions,
  useUpdateProject,
} from '@/features/project-manager/queries'
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
} from '@/features/project-manager/schemas'
import type { ProjectT } from '@/features/project-manager/types'
import { FormField, useAppForm } from '@/lib/forms'

interface ProjectEditFormProps {
  project: ProjectT
  onClose: () => void
}

function ProjectEditForm({ project, onClose }: ProjectEditFormProps) {
  const { t } = useTranslation('project-manager')
  const updateProject = useUpdateProject()

  const form = useAppForm({
    schema: projectFormSchema,
    defaultValues: projectToFormValues(project),
    onSubmit: async ({ value }) => {
      await updateProject.mutateAsync({
        projectId: project.projectCode,
        payload: buildProjectPayload(value),
      })
      onClose()
    },
  })

  return (
    <form
      key={getProjectFormKey(project)}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('form.fields.projectCode.label')}</Label>
          <Input value={project.projectCode} disabled className="w-full" />
        </div>
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
            <Select value={field.state.value} onValueChange={field.handleChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('form.fields.status.placeholder')} />
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
          disabled={updateProject.isPending}
        >
          {t('form.actions.cancel')}
        </Button>
        <Button type="submit" disabled={updateProject.isPending}>
          {updateProject.isPending
            ? t('form.actions.saving')
            : t('form.actions.update')}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface ProjectEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
  fallbackProject?: ProjectT | null
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  projectId,
  fallbackProject = null,
}: ProjectEditDialogProps) {
  const { t } = useTranslation('project-manager')

  const { data: project, isLoading, isError } = useQuery({
    ...projectDetailQueryOptions(projectId ?? ''),
    enabled: open && Boolean(projectId),
  })

  const resolvedProject = mergeProjectData(project, fallbackProject)
  const showLoading = isLoading && !resolvedProject

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('form.editTitle')}</DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError && !resolvedProject ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('errors.detailFailed')}
          </p>
        ) : resolvedProject ? (
          <ProjectEditForm
            key={getProjectFormKey(resolvedProject)}
            project={resolvedProject}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
