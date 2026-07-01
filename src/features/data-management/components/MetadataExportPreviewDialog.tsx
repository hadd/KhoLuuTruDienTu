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
import type { MetadataExportPreviewResultT } from '@/features/data-management/api/dossierClient'
import { MetadataExportPreviewTable } from '@/features/data-management/components/MetadataExportPreviewTable'

interface MetadataExportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: MetadataExportPreviewResultT | null
  mode?: 'structure' | 'data'
}

export function MetadataExportPreviewDialog({
  open,
  onOpenChange,
  preview,
  mode = 'structure',
}: MetadataExportPreviewDialogProps) {
  const { t } = useTranslation('data-management')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {t('recordDetail.metadataExportPreview.title')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'structure'
              ? t('recordDetail.metadataExportPreview.structureDescription')
              : t('recordDetail.metadataExportPreview.description', {
                  previewCount: preview?.previewCount ?? 0,
                  totalCount: preview?.totalCount ?? 0,
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto py-2">
          {preview ? (
            <MetadataExportPreviewTable preview={preview} mode={mode} />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('recordDetail.metadataExportPreview.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
