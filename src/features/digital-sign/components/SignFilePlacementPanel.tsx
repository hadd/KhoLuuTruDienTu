import { FileText } from 'lucide-react'
import type { ReactNode } from 'react'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import type { VisualSignaturePayload } from '@/features/digital-sign/api/digitalSignClient'
import { formatCertificateCn } from '@/lib/ca-sign/certificateDisplay'

export interface SignablePdfFile {
  id: string
  fileName: string
  filePath: string
  fileUrl?: string
  dossierId?: string
  dossierName?: string
  /** Already has a signed PDF — selecting it means re-sign from raw. */
  isSigned?: boolean
}

export function SignFilePlacementPanel({
  files,
  selectedIds,
  activeFileId,
  placements,
  onToggleFile,
  onSelectActive,
  onPlacementChange,
  stampLabel,
  controlsSlot,
  className,
}: {
  files: Array<SignablePdfFile>
  selectedIds: Set<string>
  activeFileId: string | null
  placements: Record<string, VisualSignaturePayload>
  onToggleFile: (fileId: string, checked: boolean) => void
  onSelectActive: (fileId: string) => void
  onPlacementChange: (fileId: string, patch: Partial<VisualSignaturePayload>) => void
  stampLabel?: string
  /** Chứng thư / lý do / địa điểm ký — hiển thị phía trên danh sách file ở cột trái. */
  controlsSlot?: ReactNode
  className?: string
}) {
  const activeFile = files.find((f) => f.id === activeFileId) ?? null
  const activePlacement = activeFileId ? placements[activeFileId] : undefined
  const label = stampLabel
    ? formatCertificateCn(stampLabel)
    : 'Chữ ký số'

  return (
    <div
      className={cn(
        // Desktop: 1 hàng full-height (PDF giãn hết lên sát trên cùng). Mobile: xếp dọc.
        'flex h-full min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-12 lg:grid-rows-1',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:col-span-4 lg:h-full lg:min-h-0">
        {controlsSlot ? <div className="shrink-0 space-y-2">{controlsSlot}</div> : null}
        <Label className="shrink-0 text-xs font-semibold">
          Chọn file PDF cần ký ({selectedIds.size}/{files.length})
        </Label>
        <ul className="max-h-[40vh] min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border border-border p-2 lg:max-h-none">
          {files.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              Không có file PDF chờ ký
            </li>
          ) : (
            files.map((file) => {
              const checked = selectedIds.has(file.id)
              const isActive = file.id === activeFileId
              const placed = Boolean(placements[file.id]?.xRatio !== undefined)
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                      isActive ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/60',
                    )}
                    onClick={() => onSelectActive(file.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        onToggleFile(file.id, value === true)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {file.fileName}
                        {file.isSigned ? (
                          <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
                            Ký lại
                          </span>
                        ) : null}
                      </p>
                      {file.dossierName ? (
                        <p className="truncate text-[10px] text-muted-foreground">
                          {file.dossierName}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {file.isSigned && !placed
                          ? 'Đã ký — chọn để ký lại từ bản gốc'
                          : placed
                            ? `Vị trí: trang ${placements[file.id]?.pageNumber ?? 1} (${placements[file.id]?.xRatio}%, ${placements[file.id]?.yRatio}%)`
                            : 'Chưa đặt vị trí'}
                      </p>
                    </div>
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              )
            })
          )}
        </ul>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          Chọn file → xem PDF bên phải → nhấp để đặt vị trí chữ ký.
        </p>
      </div>

      <div className="flex min-h-[60vh] flex-1 flex-col gap-2 lg:col-span-8 lg:h-full lg:min-h-0">
        <Label className="shrink-0 text-xs font-semibold">
          {activeFile
            ? `Xem trước: ${activeFile.fileName}`
            : 'Chọn một file để xem PDF và đặt vị trí'}
        </Label>
        {/* Thu hẹp chiều ngang PDF → scale nhỏ hơn → nhìn trang dài hơn theo chiều dọc. */}
        <div className="mx-auto flex h-0 min-h-0 w-full max-w-[640px] flex-1 flex-col">
          {activeFile?.fileUrl ? (
            <PdfViewer
              fileUrl={activeFile.fileUrl}
              fileName={activeFile.fileName}
              className="h-0 min-h-0 flex-1"
              showBorder
              renderTextLayer={false}
              renderAnnotationLayer={false}
              signaturePlacement={
                activePlacement?.xRatio !== undefined &&
                activePlacement?.yRatio !== undefined
                  ? {
                      pageNumber: activePlacement.pageNumber ?? 1,
                      xRatio: activePlacement.xRatio,
                      yRatio: activePlacement.yRatio,
                      widthPercent: activePlacement.widthRatio ?? 32,
                      heightPercent: activePlacement.heightRatio ?? 9,
                      label,
                    }
                  : null
              }
              onPageClick={({ pageNumber, xRatio, yRatio }) => {
                if (!activeFileId) return
                onPlacementChange(activeFileId, {
                  pageNumber,
                  xRatio,
                  yRatio,
                  widthRatio: placements[activeFileId]?.widthRatio ?? 32,
                  heightRatio: placements[activeFileId]?.heightRatio ?? 9,
                })
              }}
              onSignaturePlacementResize={({ widthPercent, heightPercent }) => {
                if (!activeFileId) return
                onPlacementChange(activeFileId, {
                  widthRatio: widthPercent,
                  heightRatio: heightPercent,
                })
              }}
              onSignaturePlacementMove={({ xRatio, yRatio }) => {
                if (!activeFileId) return
                onPlacementChange(activeFileId, { xRatio, yRatio })
              }}
            />
          ) : (
            <div className="flex h-0 min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              {activeFile
                ? 'Không tải được URL PDF của file này'
                : 'Chưa chọn file'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
