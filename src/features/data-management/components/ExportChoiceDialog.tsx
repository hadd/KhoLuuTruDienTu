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
import { metadataExportPresetOptionsQueryOptions } from '@/features/data-config/queries'
import type {
  ExportContext,
  ExportMode,
  ExportOptions,
} from '@/features/data-management/lib/exportHelpers'

const DEFAULT_PRESET_VALUE = 'default'
const FILE_NAMING_ORIGINAL = 'original'
const FILE_NAMING_CONFIG = 'config'

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
  const [fileNamingMode, setFileNamingMode] = useState(FILE_NAMING_ORIGINAL)

  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    ...metadataExportPresetOptionsQueryOptions(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setSelectedPresetId(DEFAULT_PRESET_VALUE)
    setFileNamingMode(FILE_NAMING_ORIGINAL)
  }, [open, context?.dossierId, context?.folderId])

  if (!context) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'

  function buildExportOptions(includePreset: boolean): ExportOptions | undefined {
    const options: ExportOptions = {}
    if (includePreset && selectedPresetId !== DEFAULT_PRESET_VALUE) {
      options.presetId = selectedPresetId
    }
    if (fileNamingMode === FILE_NAMING_CONFIG) {
      options.useDocumentNaming = true
    }
    return Object.keys(options).length > 0 ? options : undefined
  }

  async function handleMetadataExport() {
    await onExport('metadata', buildExportOptions(true))
  }

  async function handleDipExport() {
    await onExport('dip', buildExportOptions(false))
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

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="export-file-naming">
              {t('recordDetail.exportDialog.fileNamingLabel')}
            </Label>
            <Select
              value={fileNamingMode}
              disabled={isExporting}
              onValueChange={setFileNamingMode}
            >
              <SelectTrigger id="export-file-naming">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILE_NAMING_ORIGINAL}>
                  {t('recordDetail.exportDialog.fileNamingOriginal')}
                </SelectItem>
                <SelectItem value={FILE_NAMING_CONFIG}>
                  {t('recordDetail.exportDialog.fileNamingConfig')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {fileNamingMode === FILE_NAMING_CONFIG
                ? t('recordDetail.exportDialog.fileNamingConfigHint')
                : t('recordDetail.exportDialog.fileNamingOriginalHint')}
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
              <FileSpreadsheet
                className="size-5 text-muted-foreground"
                aria-hidden
              />
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
            onClick={() => void handleDipExport()}
            disabled={isExporting || !canExportDip}
          >
            {isExportingDip ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <FileArchive
                className="size-5 text-muted-foreground"
                aria-hidden
              />
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

          <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-center text-xs font-medium text-primary">
            {t('recordDetail.exportDialog.pdfaNotice')}
          </div>
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
