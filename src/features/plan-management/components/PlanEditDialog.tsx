import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import { planToFormValues } from '@/features/plan-management/lib/planPayload'
import {
  paperSizesQueryOptions,
  projectPlanQueryOptions,
  useUpdateProjectPlan,
} from '@/features/plan-management/queries'
import { updatePlanSchema } from '@/features/plan-management/schemas'
import type { PaperSizeT, ProjectPlanT } from '@/features/plan-management/types'
import { useAppForm } from '@/lib/forms'

interface PlanEditFormProps {
  plan: ProjectPlanT
  paperSizes: Array<PaperSizeT>
  onClose: () => void
}

function PlanEditForm({ plan, paperSizes, onClose }: PlanEditFormProps) {
  const { t } = useTranslation('plan-management')
  const updatePlan = useUpdateProjectPlan()

  const form = useAppForm({
    schema: updatePlanSchema,
    defaultValues: planToFormValues(plan, paperSizes),
    onSubmit: async ({ value }) => {
      await updatePlan.mutateAsync({
        id: plan.id,
        values: value,
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
      <PlanFormFields form={form} />

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

  const {
    data: plan,
    isLoading: isPlanLoading,
    isError,
  } = useQuery({
    ...projectPlanQueryOptions(planId ?? ''),
    enabled: open && Boolean(planId),
  })

  const {
    data: paperSizesData,
    isLoading: isPaperSizesLoading,
  } = useQuery({
    ...paperSizesQueryOptions(),
    enabled: open,
  })

  const isLoading = isPlanLoading || isPaperSizesLoading
  const paperSizes = paperSizesData?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('form.editTitle')}</DialogTitle>
          <DialogDescription>{t('form.subtitle')}</DialogDescription>
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
          <PlanEditForm
            plan={plan}
            paperSizes={paperSizes}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
