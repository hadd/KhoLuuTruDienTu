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
      {/* 
        Sử dụng tiền tố "!" (important) để ghi đè class sm:max-w mặc định của Shadcn UI.
        - h-[85vh] max-h-[90vh]: Đảm bảo hộp thoại cao ráo và cân đối.
        - w-[95vw] !max-w-[95vw]: Ép chiều rộng hộp thoại đạt 95% chiều rộng màn hình.
        - lg:!max-w-[85vw] hoặc lg:!max-w-7xl: Giới hạn độ rộng vừa phải ở màn hình cực lớn để không bị loãng dữ liệu.
      */}
      <DialogContent className="flex h-[85vh] max-h-[90vh] w-[95vw] !max-w-[95vw] lg:!max-w-[85vw] xl:!max-w-7xl flex-col overflow-hidden">
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