import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useUpdateWatermarkPdfSecurity,
  watermarkPdfSecurityQueryOptions,
} from '@/features/watermark-config/queries'
import type { WatermarkPdfSecurityT } from '@/features/watermark-config/types'

const PERMISSION_KEYS = [
  'allowPrinting',
  'allowChanging',
  'allowDocumentAssembly',
  'allowContentCopying',
  'allowContentCopyingAccessibility',
  'allowPageExtraction',
  'allowCommenting',
  'allowFormFilling',
  'allowSigning',
] as const satisfies ReadonlyArray<keyof WatermarkPdfSecurityT>

type PermissionKey = (typeof PERMISSION_KEYS)[number]

type DraftState = {
  enabled: boolean
} & Record<PermissionKey, boolean>

function toDraft(data: WatermarkPdfSecurityT): DraftState {
  return {
    enabled: data.enabled,
    allowPrinting: data.allowPrinting,
    allowChanging: data.allowChanging,
    allowDocumentAssembly: data.allowDocumentAssembly,
    allowContentCopying: data.allowContentCopying,
    allowContentCopyingAccessibility: data.allowContentCopyingAccessibility,
    allowPageExtraction: data.allowPageExtraction,
    allowCommenting: data.allowCommenting,
    allowFormFilling: data.allowFormFilling,
    allowSigning: data.allowSigning,
  }
}

interface WatermarkPdfSecurityPanelProps {
  canUpdate: boolean
}

export function WatermarkPdfSecurityPanel({
  canUpdate,
}: WatermarkPdfSecurityPanelProps) {
  const { t } = useTranslation('watermark-config')
  const query = useQuery(watermarkPdfSecurityQueryOptions())
  const mutation = useUpdateWatermarkPdfSecurity()
  const [draft, setDraft] = React.useState<DraftState | null>(null)

  React.useEffect(() => {
    if (query.data) {
      setDraft(toDraft(query.data))
    }
  }, [query.data])

  const onSave = () => {
    if (!draft) return
    mutation.mutate(draft)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pdfSecurity.title')}</CardTitle>
        <CardDescription>{t('pdfSecurity.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading || !draft ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="space-y-1">
                <Label htmlFor="pdf-security-enabled">
                  {t('pdfSecurity.enabled')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('pdfSecurity.enabledHint')}
                </p>
              </div>
              <Switch
                id="pdf-security-enabled"
                checked={draft.enabled}
                disabled={!canUpdate || mutation.isPending}
                onCheckedChange={(enabled) =>
                  setDraft((prev) => (prev ? { ...prev, enabled } : prev))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PERMISSION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={draft[key]}
                    disabled={!canUpdate || mutation.isPending || !draft.enabled}
                    onCheckedChange={(checked) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, [key]: checked === true }
                          : prev,
                      )
                    }
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      {t(`pdfSecurity.fields.${key}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {draft[key]
                        ? t('pdfSecurity.allowed')
                        : t('pdfSecurity.notAllowed')}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {canUpdate ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? t('pdfSecurity.saving')
                    : t('pdfSecurity.save')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
