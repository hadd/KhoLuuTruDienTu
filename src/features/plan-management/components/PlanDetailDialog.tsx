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
import { projectPlanQueryOptions } from '@/features/plan-management/queries'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatNumber } from '@/lib/utils/format'

interface PlanDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string | null
}

export function PlanDetailDialog({
  open,
  onOpenChange,
  planId,
}: PlanDetailDialogProps) {
  const { t } = useTranslation('plan-management')
  const language = useCurrentLanguage()

  const {
    data: plan,
    isLoading,
    isError,
  } = useQuery({
    ...projectPlanQueryOptions(planId ?? ''),
    enabled: open && Boolean(planId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('detail.title')}</DialogTitle>
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
          <dl className="grid gap-3 text-sm">
            <DetailField label={t('detail.fields.name')} value={plan.name} />
            <DetailField
              label={t('detail.fields.project')}
              value={plan.project.projectName}
            />
            <DetailField
              label={t('detail.fields.a4Pages')}
              value={formatNumber(plan.a4Pages, {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                maximumFractionDigits: 0,
              })}
            />
            <DetailField
              label={t('detail.fields.a3Pages')}
              value={formatNumber(plan.a3Pages, {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                maximumFractionDigits: 0,
              })}
            />
            <DetailField
              label={t('detail.fields.dossierCount')}
              value={formatNumber(plan.dossierCount, {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                maximumFractionDigits: 0,
              })}
            />
            <DetailField
              label={t('detail.fields.quota')}
              value={formatNumber(Number(plan.quota), {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
            <DetailField
              label={t('detail.fields.startDate')}
              value={formatDate(plan.startDate, 'PP', language)}
            />
            <DetailField
              label={t('detail.fields.endDate')}
              value={formatDate(plan.endDate, 'PP', language)}
            />
          </dl>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
