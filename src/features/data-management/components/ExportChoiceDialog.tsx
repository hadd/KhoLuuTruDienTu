import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileArchive, FileSpreadsheet, FileText, Image, Info, Loader2 } from 'lucide-react'
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
import { env } from '@/lib/utils/env'
import { cn } from '@/lib/utils/cn'

const DEFAULT_PRESET_VALUE = 'default'
const FILE_NAMING_ORIGINAL = 'original'
const FILE_NAMING_CONFIG = 'config'

const FORMAT_ORDER: ExportMode[] = ['excel', 'pdf', 'tiff', 'dip']

function isExportFormatEnabled(mode: ExportMode): boolean {
  switch (mode) {
    case 'excel':
      return env.EXPORT_EXCEL_ENABLED
    case 'pdf':
      return env.EXPORT_PDF_ENABLED
    case 'tiff':
      return env.EXPORT_TIFF_ENABLED
    case 'dip':
      return env.EXPORT_DIP_ENABLED
    default:
      return false
  }
}

export function ExportChoiceDialog({
  open,
  onOpenChange,
  context,
  canExportDip,
  onExport,
  isExporting,
  exportingMode: _exportingMode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ExportContext | null
  canExportDip: boolean
  onExport: (modes: ExportMode[], options?: ExportOptions) => Promise<void>
  isExporting: boolean
  exportingMode: ExportMode | null
}) {
  const { t } = useTranslation('data-management')
  const [selectedModes, setSelectedModes] = useState<ExportMode[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_VALUE)
  const [fileNamingMode, setFileNamingMode] = useState(FILE_NAMING_ORIGINAL)

  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    ...metadataExportPresetOptionsQueryOptions(),
    enabled: open,
  })

  const formatOptions = useMemo(() => {
    const options: Array<{
      mode: ExportMode
      icon: typeof FileSpreadsheet
      titleKey: string
      descriptionKey: string
      disabled?: boolean
    }> = [
      {
        mode: 'excel',
        icon: FileSpreadsheet,
        titleKey: 'recordDetail.exportDialog.excelOnlyOption',
        descriptionKey: 'recordDetail.exportDialog.excelOnlyOptionDescription',
      },
      {
        mode: 'pdf',
        icon: FileText,
        titleKey: 'recordDetail.exportDialog.pdfOnlyOption',
        descriptionKey: 'recordDetail.exportDialog.pdfOnlyOptionDescription',
      },
      {
        mode: 'tiff',
        icon: Image,
        titleKey: 'recordDetail.exportDialog.tiffOnlyOption',
        descriptionKey: 'recordDetail.exportDialog.tiffOnlyOptionDescription',
      },
      {
        mode: 'dip',
        icon: FileArchive,
        titleKey: 'recordDetail.exportDialog.dipOption',
        descriptionKey: canExportDip
          ? 'recordDetail.exportDialog.dipOptionDescription'
          : 'recordDetail.exportDialog.dipUnavailable',
        disabled: !canExportDip,
      },
    ]

    return options.filter((option) => isExportFormatEnabled(option.mode))
  }, [canExportDip])

  useEffect(() => {
    if (!open) return
    const enabledModes = FORMAT_ORDER.filter((mode) =>
      formatOptions.some((option) => option.mode === mode),
    )
    setSelectedModes(enabledModes.includes('excel') ? ['excel'] : [])
    setSelectedPresetId(DEFAULT_PRESET_VALUE)
    setFileNamingMode(FILE_NAMING_ORIGINAL)
  }, [open, context?.dossierId, context?.folderId, formatOptions])

  if (!context) return null

  const selectedSet = new Set(selectedModes)
  const needsPreset = selectedSet.has('excel')
  const needsFileNaming =
    selectedSet.has('pdf') || selectedSet.has('tiff') || selectedSet.has('dip')
  const showPackageNotice = selectedSet.has('pdf')
  const dipSelectedDisabled = selectedSet.has('dip') && !canExportDip
  const confirmDisabled =
    isExporting ||
    selectedModes.length === 0 ||
    dipSelectedDisabled

  function toggleMode(mode: ExportMode) {
    setSelectedModes((prev) => {
      if (prev.includes(mode)) {
        return prev.filter((item) => item !== mode)
      }
      return FORMAT_ORDER.filter(
        (item) => item === mode || prev.includes(item),
      )
    })
  }

  async function handleConfirmExport() {
    if (confirmDisabled) return

    const options: ExportOptions = {}
    if (needsPreset && selectedPresetId !== DEFAULT_PRESET_VALUE) {
      options.presetId = selectedPresetId
    }
    if (needsFileNaming && fileNamingMode === FILE_NAMING_CONFIG) {
      options.useDocumentNaming = true
    }

    await onExport(
      selectedModes,
      Object.keys(options).length > 0 ? options : undefined,
    )
  }

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('recordDetail.exportDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('recordDetail.exportDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-2">
            <Label>{t('recordDetail.exportDialog.formatLabel')}</Label>
            <div className="flex flex-col gap-2" role="group">
              {formatOptions.map((option) => {
                const Icon = option.icon
                const selected = selectedSet.has(option.mode)
                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    disabled={isExporting || option.disabled}
                    onClick={() => toggleMode(option.mode)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                      option.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40',
                      )}
                      aria-hidden
                    >
                      {selected ? (
                        <svg
                          viewBox="0 0 16 16"
                          className="size-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                        </svg>
                      ) : null}
                    </span>
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {t(option.titleKey)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(option.descriptionKey)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {needsPreset ? (
            <div className="space-y-2">
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
          ) : null}

          {needsFileNaming ? (
            <div className="space-y-2">
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
          ) : null}

          {showPackageNotice ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-left text-xs text-primary flex items-start gap-2.5">
              <Info className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden />
              <span className="leading-relaxed font-medium">
                {t('recordDetail.exportDialog.pdfaNotice')}
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {t('recordDetail.exportDialog.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirmExport()}
            disabled={confirmDisabled}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {t('recordDetail.exportDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
