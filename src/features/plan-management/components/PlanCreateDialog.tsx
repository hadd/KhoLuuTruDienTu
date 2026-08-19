import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlanFormFields } from '@/features/plan-management/components/PlanFormFields'
import { submitCreatePlanFlow } from '@/features/plan-management/lib/submitCreatePlanFlow'
import { useCreateProjectPlan } from '@/features/plan-management/queries'
import {
  createEmptyPlanFormValues,
  createPlanSchema,
} from '@/features/plan-management/schemas'
import { useAppForm } from '@/lib/forms'

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
    defaultValues: createEmptyPlanFormValues(defaultProjectCode),
    onSubmit: async ({ value }) => {
      const parsed = createPlanSchema.safeParse(value)
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? t('errors.saveFailed'))
        return
      }

      await createPlan.mutateAsync(parsed.data)
      onClose()
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="flex min-h-0 flex-col gap-4"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <PlanFormFields form={form} lockProject={lockProject} />
      </div>

      <DialogFooter className="shrink-0">
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
      <DialogContent className="sm:max-w-3xl flex max-h-[90vh] flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('form.subtitle')}</DialogDescription>
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
