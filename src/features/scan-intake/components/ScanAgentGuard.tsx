import { AlertTriangle, Download, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useScanAgentHealth } from '@/features/scan-intake/queries'

const AGENT_DOWNLOAD_URL_X86 =
  'https://github.com/tlong1610/sohoa-scan-agent/releases/download/v2.0.5/SohoaScanAgent-2.0.5-win-x86.zip'

export function ScanAgentGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('scan-intake')
  const { data, isPending, isError } = useScanAgentHealth()

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
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-6">
          <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('agent.noTwainTitle')}</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>{data?.twainHint ?? t('agent.noTwainDescription')}</p>
            <p>
              {t('agent.currentBitness', {
                bitness: data?.processBitness ?? '?',
              })}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline">
                <a href={AGENT_DOWNLOAD_URL_X86} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  {t('agent.downloadX86')}
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a
                  href="http://127.0.0.1:18612/health"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('agent.checkHealth')}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <div className="mb-2 flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t('agent.offlineTitle')}</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t('agent.offlineDescription')}</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>{t('agent.step1')}</li>
            <li>{t('agent.step2')}</li>
            <li>{t('agent.step3')}</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm" variant="outline">
              <a href={AGENT_DOWNLOAD_URL_X86} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                {t('agent.downloadX86')}
              </a>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a
                href="http://127.0.0.1:18612/health"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('agent.checkHealth')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
