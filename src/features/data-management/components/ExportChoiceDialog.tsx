import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { metadataExportPresetsQueryOptions } from '@/features/data-config/queries'
import type {
  ExportContext,
  ExportMode,
  ExportOptions,
} from '@/features/data-management/lib/exportHelpers'

const DEFAULT_PRESET_VALUE = 'default'

export function ExportChoiceDialog({
  open,
  onOpenChange,
  context,
  canExportDip,
  onExport,
  isExporting,
  exportingMode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ExportContext | null
  canExportDip: boolean
  onExport: (mode: ExportMode, options?: ExportOptions) => Promise<void>
  isExporting: boolean
  exportingMode: ExportMode | null
}) {
  const { t } = useTranslation('data-management')
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_VALUE)

  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    ...metadataExportPresetsQueryOptions(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setSelectedPresetId(DEFAULT_PRESET_VALUE)
  }, [open, context?.dossierId, context?.folderId])

  if (!context) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'

  async function handleMetadataExport() {
    const options =
      selectedPresetId !== DEFAULT_PRESET_VALUE
        ? { presetId: selectedPresetId }
        : undefined
    await onExport('metadata', options)
  }

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('recordDetail.exportDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('recordDetail.exportDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="metadata-export-preset">
              {t('recordDetail.exportDialog.presetLabel')}
            </Label>
            <Select
              value={selectedPresetId}
              disabled={isExporting || isLoadingPresets}
              onValueChange={setSelectedPresetId}
            >
              <SelectTrigger id="metadata-export-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_PRESET_VALUE}>
                  {t('recordDetail.exportDialog.defaultPresetOption')}
                </SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isLoadingPresets
                ? t('recordDetail.exportDialog.loadingPresets')
                : selectedPresetId === DEFAULT_PRESET_VALUE
                  ? t('recordDetail.exportDialog.defaultPresetHint')
                  : t('recordDetail.exportDialog.selectedPresetHint')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3"
            onClick={() => void handleMetadataExport()}
            disabled={isExporting}
          >
            {isExportingMetadata ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
            )}
            <div className="flex flex-col items-start gap-0.5 text-left">
              <span className="font-medium">
                {t('recordDetail.exportDialog.metadataOption')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('recordDetail.exportDialog.metadataOptionDescription')}
              </span>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3"
            onClick={() => void onExport('dip')}
            disabled={isExporting || !canExportDip}
          >
            {isExportingDip ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <FileArchive className="size-5 text-muted-foreground" aria-hidden />
            )}
            <div className="flex flex-col items-start gap-0.5 text-left">
              <span className="font-medium">
                {t('recordDetail.exportDialog.dipOption')}
              </span>
              <span className="text-xs text-muted-foreground">
                {canExportDip
                  ? t('recordDetail.exportDialog.dipOptionDescription')
                  : t('recordDetail.exportDialog.dipUnavailable')}
              </span>
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {t('recordDetail.exportDialog.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
