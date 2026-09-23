import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DashboardWorkloadVolumeT } from '@/features/dashboard/lib/normalizeVolume'
import { formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

type VolumeKpiCardProps = {
  icon: LucideIcon
  label: string
  volume: DashboardWorkloadVolumeT
  className?: string
}

export function VolumeKpiCard({
  icon: Icon,
  label,
  volume,
  className,
}: VolumeKpiCardProps) {
  const { t } = useTranslation('admin-dashboard')

  return (
    <Card variant="list" className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
          <Icon className="size-4 shrink-0 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <VolumeRow
          label={t('workloadStats.labels.dossiers')}
          value={volume.dossiers}
        />
        <VolumeRow
          label={t('workloadStats.labels.files')}
          value={volume.files}
        />
        <VolumeRow
          label={t('workloadStats.labels.pages')}
          value={volume.pages}
        />
      </CardContent>
    </Card>
  )
}

function VolumeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">
        {formatNumber(value, { maximumFractionDigits: 0 })}
      </span>
    </div>
  )
}
