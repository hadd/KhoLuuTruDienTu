import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  exportDossiersDipByIds,
  exportDossiersMetadataByIds,
  type ArchiveWarehouseExportModeT,
} from '@/features/archive-warehouse/api/archiveWarehouseExportClient'
import { metadataExportPresetOptionsQueryOptions } from '@/features/data-config/queries'
import type { WatermarkPlacementSummaryT } from '@/features/watermark-config/types'
import { apiClient } from '@/lib/api/apiClient'
import { translateError } from '@/lib/utils/translate-error'

const DEFAULT_PRESET_VALUE = 'default'
const NO_WATERMARK_VALUE = 'none'

export function ArchiveWarehouseExportDialog({
  open,
  onOpenChange,
  dossierIds,
  dossierNames,
  onExported,
  allowOriginalDownload = true,
  allowWatermarkDownload = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierIds: Array<string>
  dossierNames?: Array<string>
  onExported?: () => void
  allowOriginalDownload?: boolean
  allowWatermarkDownload?: boolean
}) {
  const { t } = useTranslation('archive-warehouse')
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_VALUE)
  const [selectedPlacementId, setSelectedPlacementId] =
    useState(NO_WATERMARK_VALUE)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingMode, setExportingMode] =
    useState<ArchiveWarehouseExportModeT | null>(null)

  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    ...metadataExportPresetOptionsQueryOptions(),
    enabled: open,
  })

  const { data: placements = [], isLoading: isLoadingPlacements } = useQuery({
    queryKey: ['archive-warehouse', 'export-watermark-placements'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<Array<WatermarkPlacementSummaryT>>(
          '/api/v1/admin/watermark/placements',
          { _skipGlobalErrorToast: true },
        )
        return response.data
      } catch {
        // User may lack WATERMARK_CONFIG_READ; export still works without watermark list.
        return []
      }
    },
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })

  const watermarkOnly = allowWatermarkDownload && !allowOriginalDownload
  const originalOnly = allowOriginalDownload && !allowWatermarkDownload

  useEffect(() => {
    if (!open) return
    setSelectedPresetId(DEFAULT_PRESET_VALUE)
    setSelectedPlacementId(
      watermarkOnly && placements.length > 0
        ? placements[0].id
        : NO_WATERMARK_VALUE,
    )
    setIsExporting(false)
    setExportingMode(null)
  }, [open, dossierIds, watermarkOnly, placements])

  if (dossierIds.length === 0) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'
  const mustSelectWatermark =
    watermarkOnly && selectedPlacementId === NO_WATERMARK_VALUE
  const downloadName =
    dossierIds.length === 1
      ? (dossierNames?.[0] || `dossier-${dossierIds[0]}`)
      : `export-${dossierIds.length}-dossiers`

  async function runExport(mode: ArchiveWarehouseExportModeT) {
    if (dossierIds.length === 0 || isExporting) return

    setIsExporting(true)
    setExportingMode(mode)

    const placementId =
      selectedPlacementId !== NO_WATERMARK_VALUE
        ? selectedPlacementId
        : undefined
    const presetId =
      selectedPresetId !== DEFAULT_PRESET_VALUE ? selectedPresetId : undefined

    try {
      if (mode === 'metadata') {
        await exportDossiersMetadataByIds(dossierIds, downloadName, {
          presetId,
          placementId,
        })
      } else {
        await exportDossiersDipByIds(dossierIds, downloadName, {
          placementId,
        })
      }
      toast.success(t('export.success'))
      onExported?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(translateError(error instanceof Error ? error : new Error(t('export.failed'))))
    } finally {
      setIsExporting(false)
      setExportingMode(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('export.title')}</DialogTitle>
          <DialogDescription>
            {t('export.description', { count: dossierIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="archive-export-preset">
              {t('export.presetLabel')}
            </Label>
            <Select
              value={selectedPresetId}
              disabled={isExporting || isLoadingPresets}
              onValueChange={setSelectedPresetId}
            >
              <SelectTrigger id="archive-export-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_PRESET_VALUE}>
                  {t('export.defaultPresetOption')}
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
                ? t('export.loadingPresets')
                : selectedPresetId === DEFAULT_PRESET_VALUE
                  ? t('export.defaultPresetHint')
                  : t('export.selectedPresetHint')}
            </p>
          </div>

          {!originalOnly ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="archive-export-watermark">
                {t('export.watermarkLabel')}
              </Label>
              <Select
                value={selectedPlacementId}
                disabled={isExporting || isLoadingPlacements}
                onValueChange={setSelectedPlacementId}
              >
                <SelectTrigger id="archive-export-watermark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowOriginalDownload ? (
                    <SelectItem value={NO_WATERMARK_VALUE}>
                      {t('export.noWatermarkOption')}
                    </SelectItem>
                  ) : null}
                  {placements.map((placement) => (
                    <SelectItem key={placement.id} value={placement.id}>
                      {placement.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isLoadingPlacements
                  ? t('export.loadingWatermarks')
                  : watermarkOnly && placements.length === 0
                    ? t('export.noPlacementsAvailable')
                    : mustSelectWatermark
                      ? t('export.watermarkRequiredHint')
                      : selectedPlacementId === NO_WATERMARK_VALUE
                        ? t('export.noWatermarkHint')
                        : t('export.selectedWatermarkHint')}
              </p>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3"
            onClick={() => void runExport('metadata')}
            disabled={isExporting || mustSelectWatermark}
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
              <span className="font-medium">{t('export.metadataOption')}</span>
              <span className="text-xs text-muted-foreground">
                {t('export.metadataOptionDescription')}
              </span>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3"
            onClick={() => void runExport('dip')}
            disabled={isExporting || mustSelectWatermark}
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
              <span className="font-medium">{t('export.dipOption')}</span>
              <span className="text-xs text-muted-foreground">
                {t('export.dipOptionDescription')}
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
            {t('export.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
