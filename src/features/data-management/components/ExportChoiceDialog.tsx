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
import type {
  ExportContext,
  ExportMode,
} from '@/features/data-management/lib/exportHelpers'

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
  onExport: (mode: ExportMode) => Promise<void>
  isExporting: boolean
  exportingMode: ExportMode | null
}) {
  const { t } = useTranslation('data-management')

  if (!context) return null

  const isExportingMetadata = isExporting && exportingMode === 'metadata'
  const isExportingDip = isExporting && exportingMode === 'dip'

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
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 px-4 py-3"
            onClick={() => void onExport('metadata')}
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
            onClick={() => void onExport('dip')}
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
