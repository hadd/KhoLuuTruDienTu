import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  RotateCw,
  ScanLine,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScanAgentError } from '@/features/scan-intake/api/scanAgentClient'
import type { ScanIntakeInboxDoc } from '@/features/scan-intake/types'
import type { useScanIntakeMutations } from '@/features/scan-intake/queries'
import { cn } from '@/lib/utils/cn'

interface PageGridProps {
  document: ScanIntakeInboxDoc
  mutations: ReturnType<typeof useScanIntakeMutations>
  scanDisabled?: boolean
  onRename?: () => void
  renameDisabled?: boolean
}

function SortablePageCard({
  pageKey,
  previewUrl,
  index,
  onPreview,
  onRotate,
  onDelete,
  disabled,
}: {
  pageKey: string
  previewUrl: string
  index: number
  onPreview: () => void
  onRotate: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation('scan-intake')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pageKey, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        className="relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-muted"
        onClick={onPreview}
        title={t('pages.viewLarge')}
      >
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full object-contain"
        />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {index + 1}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
          <ZoomIn className="h-8 w-8 text-white drop-shadow" />
        </span>
      </button>

      <div className="flex items-center gap-1 border-t p-1">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label={t('pages.drag')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onRotate}
          disabled={disabled}
          title={t('pages.rotate')}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={disabled}
          title={t('pages.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function PageGrid({
  document,
  mutations,
  scanDisabled,
  onRename,
  renameDisabled,
}: PageGridProps) {
  const { t } = useTranslation('scan-intake')
  const [previewPage, setPreviewPage] = useState<{
    url: string
    index: number
  } | null>(null)
  const [duplexScan, setDuplexScan] = useState(false)

  const pages = document.pages
  const isBusy =
    mutations.scanPageMutation.isPending ||
    mutations.rotatePageMutation.isPending ||
    mutations.deletePageMutation.isPending ||
    mutations.reorderPageMutation.isPending ||
    mutations.assemblePdfMutation.isPending ||
    mutations.organizeRenamePdfMutation.isPending

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  async function handleScan() {
    try {
      toast.info(duplexScan ? t('pages.scanDuplexStarting') : t('pages.scanStarting'))
      const result = await mutations.scanPageMutation.mutateAsync({
        docSlug: document.docSlug,
        pageCount: pages.length,
        duplex: duplexScan,
      })
      if (result && 'cancelled' in result && result.cancelled) {
        toast.message(t('pages.scanCancelled'))
        return
      }
      if (result && 'pageCount' in result && typeof result.pageCount === 'number') {
        toast.success(t('pages.scanBatchSuccess', { count: result.pageCount }))
        return
      }
      toast.success(t('pages.scanSuccess'))
    } catch (err) {
      const message =
        err instanceof ScanAgentError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('pages.scanFailed')
      toast.error(message)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const keys = pages.map((p) => p.key)
    const oldIndex = keys.indexOf(String(active.id))
    const newIndex = keys.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = [...keys]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved!)

    try {
      await mutations.reorderPageMutation.mutateAsync({
        docSlug: document.docSlug,
        pageKeys: reordered,
      })
      toast.success(t('pages.reorderSuccess'))
    } catch {
      toast.error(t('pages.reorderFailed'))
      mutations.invalidateSession()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="truncate font-medium">{document.displayName}</h3>
            {onRename ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                disabled={isBusy || renameDisabled}
                onClick={onRename}
                title={t('documents.renameTitle')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('pages.count', { count: pages.length })}
            {document.pdfKey ? ` · ${t('pages.pdfSaved')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`duplex-${document.docSlug}`}
              checked={duplexScan}
              onCheckedChange={(checked) => setDuplexScan(checked === true)}
              disabled={isBusy || scanDisabled}
            />
            <Label
              htmlFor={`duplex-${document.docSlug}`}
              className="cursor-pointer text-sm font-normal"
            >
              {t('pages.duplex')}
            </Label>
          </div>
          <Button onClick={() => void handleScan()} disabled={isBusy || scanDisabled}>
            {mutations.scanPageMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="mr-2 h-4 w-4" />
            )}
            {t('pages.scan')}
          </Button>
          <Button
            variant="secondary"
            disabled={isBusy || pages.length === 0}
            onClick={() => {
              void mutations.assemblePdfMutation
                .mutateAsync({
                  docSlug: document.docSlug,
                  displayName: document.displayName,
                })
                .then(() => toast.success(t('pages.savePdfSuccess')))
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : t('pages.savePdfFailed'),
                  ),
                )
            }}
          >
            {mutations.assemblePdfMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {t('pages.savePdf')}
          </Button>
        </div>
      </div>

      {document.pdfUrl ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium">{t('pages.pdfPreview')}</p>
          <iframe
            src={document.pdfUrl}
            title={document.displayName}
            className="h-[480px] w-full rounded border bg-white"
          />
        </div>
      ) : null}

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('pages.empty')}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <SortableContext
            items={pages.map((p) => p.key)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pages.map((page, index) => (
                <SortablePageCard
                  key={page.key}
                  pageKey={page.key}
                  previewUrl={page.previewUrl ?? ''}
                  index={index}
                  onPreview={() => {
                    if (!page.previewUrl) return
                    setPreviewPage({ url: page.previewUrl, index })
                  }}
                  disabled={isBusy}
                  onRotate={() => {
                    if (!page.previewUrl) return
                    void mutations.rotatePageMutation.mutateAsync({
                      docSlug: document.docSlug,
                      pageKey: page.key,
                      previewUrl: page.previewUrl,
                      degrees: 90,
                    })
                  }}
                  onDelete={() => {
                    void mutations.deletePageMutation.mutateAsync(page.key)
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog
        open={previewPage !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPage(null)
        }}
      >
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>
              {previewPage
                ? t('pages.imagePreviewTitle', { number: previewPage.index + 1 })
                : ''}
            </DialogTitle>
          </DialogHeader>
          {previewPage ? (
            <div className="flex max-h-[calc(95vh-4rem)] items-center justify-center overflow-auto bg-muted/30 p-4">
              <img
                src={previewPage.url}
                alt=""
                className="max-h-[calc(95vh-6rem)] w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
