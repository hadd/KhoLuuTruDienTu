import { useQuery } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getPrimaryAppRoleFromProfile } from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  pageQuotaQueryOptions,
  useUploadPageQuotaLicenseMutation,
} from '@/features/metadata-extract/queries'

function formatPages(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('vi-VN').format(value)
}

export function PageQuotaCard() {
  const { t } = useTranslation('metadata-extract-settings')
  const { data: user } = useQuery(profileQueryOptions)
  const role = getPrimaryAppRoleFromProfile(user)
  const isAdmin = role === 'admin'

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, error, isLoading, refetch, isFetching } = useQuery({
    ...pageQuotaQueryOptions(),
    enabled: isAdmin,
  })
  const uploadMutation = useUploadPageQuotaLicenseMutation()

  if (!isAdmin) return null

  const limit = data?.pageLimit ?? null
  const used = data?.usedPages ?? 0
  const pending = data?.pendingPages ?? 0
  const remaining = data?.remaining ?? null
  const percent =
    limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : 0
  const lowRemaining =
    limit != null &&
    remaining != null &&
    (remaining === 0 || remaining / limit <= 0.01)
  const hasLoadError = error != null

  let content: React.ReactNode
  if (isLoading) {
    content = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('quota.loading')}
      </div>
    )
  } else if (hasLoadError) {
    content = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{t('quota.loadFailed')}</p>
        <button
          type="button"
          className="w-fit text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {t('actions.retry')}
        </button>
      </div>
    )
  } else {
    content = (
      <>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t('quota.used')}</p>
            <p className="text-lg font-semibold">{formatPages(used)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('quota.limit')}</p>
            <p className="text-lg font-semibold">{formatPages(limit)}</p>
          </div>
        </div>

        {limit != null ? (
          <div className="flex flex-col gap-1.5">
            <Progress
              value={percent}
              indicatorClassName={
                data?.routingStopped || lowRemaining ? 'bg-destructive' : undefined
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('quota.remaining', { remaining: formatPages(remaining) })}
            </p>
            {pending > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('quota.pending', { pending: formatPages(pending) })}
              </p>
            ) : null}
            {lowRemaining ? (
              <p className="text-sm text-destructive">
                {t('quota.lowRemaining')}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('quota.noLicense')}
          </p>
        )}

        {data?.routingStopped ? (
          <p className="text-sm text-destructive">{t('quota.stopped')}</p>
        ) : null}

        {data?.customer ? (
          <p className="text-xs text-muted-foreground">
            {t('quota.customer', { name: data.customer })}
          </p>
        ) : null}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".lic,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              uploadMutation.mutate(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {t('quota.upload')}
          </Button>
        </div>
      </>
    )
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t('quota.title')}</CardTitle>
        <CardDescription>{t('quota.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{content}</CardContent>
    </Card>
  )
}
