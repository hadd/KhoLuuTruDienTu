import { AlertCircle, Download, PlugZap, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useScanAgentHealth } from '@/features/scan-intake/queries'

const AGENT_DOWNLOAD_URL_X86 =
  'https://github.com/tlong1610/sohoa-scan-agent/releases/download/v2.0.5/SohoaScanAgent-2.0.5-win-x86.zip'

export function ScanAgentGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('scan-intake')
  const { data, isPending, isError, refetch, isFetching } = useScanAgentHealth()

  const isOnline = !isPending && !isError && data?.status === 'ok'
  const twainSources = data?.twainSources ?? []
  const needsX86 =
    isOnline &&
    twainSources.length === 0 &&
    (data?.processBitness === 'x64' || Boolean(data?.twainHint))

  if (isOnline && !needsX86) {
    return <>{children}</>
  }

  if (isOnline && needsX86) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 dark:bg-amber-500/10">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-amber-500/15 p-3 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              {t('agent.noTwainTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('agent.noTwainDescription')}
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                />
                {t('agent.retryConnection')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 dark:bg-amber-500/10">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-amber-500/15 p-3 text-amber-600 dark:text-amber-400">
          <PlugZap className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('agent.offlineTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('agent.offlineDescription')}
            </p>
          </div>

          <div className="rounded-lg bg-background/60 p-3.5 text-xs text-muted-foreground border border-border/40 space-y-1.5">
            <p className="font-medium text-foreground">{t('agent.step1')}</p>
            <p>{t('agent.step2')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <a href={AGENT_DOWNLOAD_URL_X86} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                {t('agent.downloadPlugin')}
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
              />
              {t('agent.retryConnection')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

