import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateDisposalSettings } from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryKey } from '@/features/archive-disposal-council/queries'
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
    <Card className="w-fit max-w-full">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <Label htmlFor="council-review-enabled" className="text-sm font-medium">
          {t('settings.title')}
        </Label>
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
      </CardContent>
    </Card>
  )
}
