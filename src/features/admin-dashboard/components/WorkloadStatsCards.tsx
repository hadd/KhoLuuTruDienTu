import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileStack,
  UserX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AdminDashboardWorkloadStatsT } from '@/features/admin-dashboard/types'
import { formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

import { formatPercentValue } from './AdminDashboardPage'

type WorkloadStatsCardsProps = {
  stats: AdminDashboardWorkloadStatsT
  className?: string
}

const METRICS = [
  {
    key: 'total' as const,
    icon: FileStack,
    accent: 'text-blue-600',
  },
  {
    key: 'unentered' as const,
    icon: ClipboardList,
    accent: 'text-amber-600',
  },
  {
    key: 'unassigned' as const,
    icon: UserX,
    accent: 'text-orange-600',
  },
  {
    key: 'completed' as const,
    icon: CheckCircle2,
    accent: 'text-emerald-600',
  },
  {
    key: 'error' as const,
    icon: AlertTriangle,
    accent: 'text-destructive',
  },
]

export function WorkloadStatsCards({ stats, className }: WorkloadStatsCardsProps) {
  const { t } = useTranslation('admin-dashboard')
  const totalVolume = stats.total
  const completedVolume = stats.completed

  return (
    <section
      className={cn(
        'grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5',
        className,
      )}
    >
      {METRICS.map(({ key, icon: Icon, accent }) => {
        const volume = stats[key]
        const isTotal = key === 'total'
        const isError = key === 'error'
        const refVolume = isTotal ? null : isError ? completedVolume : totalVolume

        const overallFilePct =
          !isTotal && refVolume && refVolume.files > 0
            ? (volume.files / refVolume.files) * 100
            : null

        return (
          <Card key={key} variant="list">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CardTitle className="text-sm font-semibold">
                      {t(`workloadStats.${key}.title`)}
                    </CardTitle>
                    {overallFilePct !== null ? (
                      <span className="text-xs font-semibold text-muted-foreground">
                        ({formatPercentValue(overallFilePct, 1)})
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="text-xs">
                    {t(`workloadStats.${key}.description`)}
                  </CardDescription>
                </div>
                <Icon className={cn('size-4 shrink-0', accent)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('workloadStats.labels.dossiers')}
                </span>
                <div className="flex items-center gap-1 tabular-nums">
                  <span className="font-semibold">
                    {formatNumber(volume.dossiers, { maximumFractionDigits: 0 })}
                  </span>
                  {refVolume ? (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({formatNumber(refVolume.dossiers, { maximumFractionDigits: 0 })})
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('workloadStats.labels.files')}
                </span>
                <div className="flex items-center gap-1 tabular-nums">
                  <span className="font-semibold">
                    {formatNumber(volume.files, { maximumFractionDigits: 0 })}
                  </span>
                  {refVolume ? (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({formatNumber(refVolume.files, { maximumFractionDigits: 0 })})
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('workloadStats.labels.pages')}
                </span>
                <div className="flex items-center gap-1 tabular-nums">
                  <span className="font-semibold">
                    {formatNumber(volume.pages, { maximumFractionDigits: 0 })}
                  </span>
                  {refVolume ? (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({formatNumber(refVolume.pages, { maximumFractionDigits: 0 })})
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
