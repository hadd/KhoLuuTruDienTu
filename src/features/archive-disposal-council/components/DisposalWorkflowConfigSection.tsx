import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateDisposalSettings } from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryKey } from '@/features/archive-disposal-council/queries'
import { formatDate } from '@/lib/utils/date'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { translateError } from '@/lib/utils/translate-error'

type DisposalWorkflowConfigSectionProps = {
  settings: {
    councilReviewEnabled: boolean
    updatedAt: string
  } | undefined
  isLoading?: boolean
}

export function DisposalWorkflowConfigSection({
  settings,
  isLoading,
}: DisposalWorkflowConfigSectionProps) {
  const { t } = useTranslation('archive-disposal-council')
  const language = useCurrentLanguage()
  const queryClient = useQueryClient()
  const { canReadDisposalSettings, canUpdateDisposalSettings } =
    useDisposalCouncilAccess()

  const mutation = useMutation({
    mutationFn: updateDisposalSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: disposalSettingsQueryKey })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  if (!canReadDisposalSettings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="council-review-enabled">{t('settings.councilReviewEnabled')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.councilReviewEnabledHint')}
            </p>
            {!canUpdateDisposalSettings ? (
              <p className="text-xs text-muted-foreground">{t('settings.readOnlyHint')}</p>
            ) : null}
          </div>
          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="council-review-enabled"
              checked={settings?.councilReviewEnabled ?? true}
              disabled={!canUpdateDisposalSettings || mutation.isPending}
              onCheckedChange={(checked) => mutation.mutate({ councilReviewEnabled: checked })}
            />
          )}
        </div>
        {settings?.updatedAt ? (
          <p className="text-xs text-muted-foreground">
            {t('settings.updatedAt', {
              date: formatDate(settings.updatedAt, language, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
