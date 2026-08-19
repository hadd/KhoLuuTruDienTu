import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import type { MetadataExtractMode } from '@/features/metadata-extract/api/metadataExtractClient'
import { useMetadataExtractSettingsAccess } from '@/features/metadata-extract/hooks/useMetadataExtractSettingsAccess'
import {
  metadataExtractSettingsQueryOptions,
  useUpdateMetadataExtractSettingsMutation,
} from '@/features/metadata-extract/queries'

// Luồng chọn model bóc tách metadata (TT05 / OLD) tạm thời được comment lại theo yêu cầu.
// Vẫn giữ nguyên chế độ Manual / Auto khi upload hồ sơ/tài liệu.
// const MODE_OPTIONS: MetadataExtractMode[] = ['old', 'tt05']

export function MetadataExtractSettingsPage() {
  const { t } = useTranslation('metadata-extract-settings')
  const { canUpdate } = useMetadataExtractSettingsAccess()
  const { data: settings, isLoading, isError, refetch, isFetching } = useQuery(
    metadataExtractSettingsQueryOptions(),
  )
  const mutation = useUpdateMetadataExtractSettingsMutation({
    successMessage: t('toast.updated'),
  })

  const currentMode = settings?.mode ?? 'old'
  /*
  const selectOptions: MetadataExtractMode[] =
    currentMode === 'off' ? [...MODE_OPTIONS, 'off'] : MODE_OPTIONS
  */

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <DataConfigSectionTabs active="metadata-extract-settings" />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('errors.loadFailed')}
            </div>
          ) : isError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">{t('errors.loadFailed')}</p>
              <button
                type="button"
                className="w-fit text-sm font-medium underline-offset-4 hover:underline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {t('actions.retry')}
              </button>
            </div>
          ) : (
            <>
              {/* 
                Luồng chọn model (TT05 hoặc OLD) tạm thời comment lại theo yêu cầu.
                Chế độ Manual / Auto khi upload vẫn được giữ nguyên.
              */}
              {/* 
              <div className="flex flex-col gap-2">
                <Label htmlFor="metadata-extract-mode">{t('mode.label')}</Label>
                <Select
                  value={currentMode}
                  disabled={!canUpdate || mutation.isPending}
                  onValueChange={(value) => {
                    const mode = value as MetadataExtractMode
                    if (mode === currentMode) return
                    mutation.mutate(mode)
                  }}
                >
                  <SelectTrigger id="metadata-extract-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectOptions.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {t(`mode.${mode}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              */}

              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
                <p className="font-medium">Luồng chọn model (TT05 / Old) đã được tạm ẩn/comment.</p>
                <p className="mt-1 text-xs text-amber-700">
                  Tùy chọn bóc tách thủ công (Manual) và tự động (Auto) khi tải lên hồ sơ/tài liệu vẫn được giữ nguyên.
                </p>
              </div>

              {!canUpdate ? (
                <p className="text-xs text-muted-foreground">{t('readOnlyHint')}</p>
              ) : null}

              {mutation.isPending ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('actions.save')}…
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

 