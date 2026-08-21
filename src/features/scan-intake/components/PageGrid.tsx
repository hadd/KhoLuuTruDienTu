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
  RotateCcw,
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
  selected,
  onToggleSelect,
  onPreview,
  onRotate,
  onDelete,
  disabled,
}: {
  pageKey: string
  previewUrl: string
  index: number
  selected: boolean
  onToggleSelect: (key: string) => void
  onPreview: () => void
  onRotate: (degrees: number) => void
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
        'group relative flex flex-col overflow-hidden rounded-md border bg-card shadow-sm',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        className="relative aspect-[3/4] max-h-[220px] w-full cursor-zoom-in overflow-hidden bg-muted"
        onClick={onPreview}
        title={t('pages.viewLarge')}
      >
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full object-contain"
        />
        <div className="absolute left-1.5 top-1.5 z-20 flex items-center gap-1.5">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(pageKey)}
            className="h-4 w-4 border-white/60 bg-black/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {index + 1}
          </span>
        </div>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
          <ZoomIn className="h-6 w-6 text-white drop-shadow" />
        </span>
      </button>

      <div className="flex items-center gap-0.5 border-t bg-card px-1 py-0.5">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label={t('pages.drag')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onRotate(-90)}
          disabled={disabled}
          title={t('pages.rotateCcw')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onRotate(90)}
          disabled={disabled}
          title={t('pages.rotateCw')}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={disabled}
          title={t('pages.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
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
  const [selectedPageKeys, setSelectedPageKeys] = useState<Set<string>>(new Set())
  const [previewPage, setPreviewPage] = useState<{
    url: string
    index: number
  } | null>(null)
  const [duplexScan, setDuplexScan] = useState(false)
  const [isHandling, setIsHandling] = useState(false)

  const pages = document.pages
  const isBusy =
    isHandling ||
    mutations.scanPageMutation.isPending ||
    mutations.rotatePageMutation.isPending ||
    mutations.deletePageMutation.isPending ||
    mutations.deletePagesMutation.isPending ||
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
    if (isHandling) return
    setIsHandling(true)
    try {
      toast.info(duplexScan ? t('pages.scanDuplexStarting') : t('pages.scanStarting'))
      const result = await mutations.scanPageMutation.mutateAsync({
        docSlug: document.docSlug,
        pageCount: pages.length,
        existingKeys: pages.map((p) => p.key),
        duplex: duplexScan,
      })
      if (result && 'cancelled' in result && result.cancelled) {
        toast.message(t('pages.scanCancelled'))
        return
      }

      await mutations.assemblePdfMutation.mutateAsync({
        docSlug: document.docSlug,
        displayName: document.displayName,
      })

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
    } finally {
      setIsHandling(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (isHandling) return
    setIsHandling(true)
    try {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const keys = pages.map((p) => p.key)
      const oldIndex = keys.indexOf(String(active.id))
      const newIndex = keys.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return

      const reordered = [...keys]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved!)

      await mutations.reorderPageMutation.mutateAsync({
        docSlug: document.docSlug,
        pageKeys: reordered,
      })

      await mutations.assemblePdfMutation.mutateAsync({
        docSlug: document.docSlug,
        displayName: document.displayName,
      })

      toast.success(t('pages.reorderSuccess'))
    } catch {
      toast.error(t('pages.reorderFailed'))
      mutations.invalidateSession()
    } finally {
      setIsHandling(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2.5 overflow-hidden">
      {/* Thanh tác vụ chọn nhiều */}
      {selectedPageKeys.size > 0 ? (
        <div className="shrink-0 flex items-center justify-between rounded-md border bg-muted/50 p-1.5 px-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium">
              {t('pages.selectedCount', { count: selectedPageKeys.size })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedPageKeys(new Set())}
            >
              {t('pages.deselectAll')}
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            disabled={isBusy}
            onClick={async () => {
              if (isHandling) return
              if (!window.confirm(t('pages.deleteBulkConfirm', { count: selectedPageKeys.size }))) return
              setIsHandling(true)
              try {
                await mutations.deletePagesMutation.mutateAsync(Array.from(selectedPageKeys))
                setSelectedPageKeys(new Set())
                if (pages.length - selectedPageKeys.size > 0) {
                  await mutations.assemblePdfMutation.mutateAsync({
                    docSlug: document.docSlug,
                    displayName: document.displayName,
                  })
                }
                toast.success(t('pages.deleteBulkSuccess'))
              } catch {
                toast.error(t('pages.deleteBulkFailed'))
              } finally {
                setIsHandling(false)
              }
            }}
          >
            {mutations.deletePagesMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('pages.deleteSelected')}
          </Button>
        </div>
      ) : null}

      {/* Header thanh công cụ */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div>
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="truncate text-sm font-semibold">{document.displayName}</h3>
            {onRename ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={isBusy || renameDisabled}
                onClick={onRename}
                title={t('documents.renameTitle')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('pages.count', { count: pages.length })}
            {document.pdfKey ? ` · ${t('pages.pdfSaved')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`duplex-${document.docSlug}`}
              checked={duplexScan}
              onCheckedChange={(checked) => setDuplexScan(checked === true)}
              disabled={isBusy || scanDisabled}
            />
            <Label
              htmlFor={`duplex-${document.docSlug}`}
              className="cursor-pointer text-xs font-normal"
            >
              {t('pages.duplex')}
            </Label>
          </div>
          <Button size="sm" onClick={() => void handleScan()} disabled={isBusy || scanDisabled}>
            {mutations.scanPageMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanLine className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('pages.scan')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isBusy || pages.length === 0}
            onClick={async () => {
              if (isHandling) return
              setIsHandling(true)
              try {
                await mutations.assemblePdfMutation.mutateAsync({
                  docSlug: document.docSlug,
                  displayName: document.displayName,
                })
                toast.success(t('pages.savePdfSuccess'))
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : t('pages.savePdfFailed'),
                )
              } finally {
                setIsHandling(false)
              }
            }}
          >
            {mutations.assemblePdfMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('pages.savePdf')}
          </Button>
        </div>
      </div>

      {/* Khu vực nội dung: 2/3 Trái là PDF, 1/3 Phải là Danh sách trang */}
      <div className="grid flex-1 min-h-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        {/* CỘT TRÁI: Xem PDF (2/3 chiều rộng) */}
        <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/30 p-2 overflow-hidden">
          <p className="mb-1 shrink-0 text-xs font-medium text-muted-foreground">{t('pages.pdfPreview')}</p>
          {document.pdfUrl ? (
            <iframe
              src={document.pdfUrl}
              title={document.displayName}
              className="h-full min-h-0 flex-1 w-full rounded border bg-white"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded border border-dashed bg-card/40 text-center text-xs text-muted-foreground">
              {t('pages.pdfNotCreated', { defaultValue: 'Chưa có bản xem trước PDF' })}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: Danh sách trang (1/3 chiều rộng, có Scrollbar riêng) */}
        <div className="flex h-full min-h-0 flex-col rounded-lg border bg-card p-2 overflow-hidden">
          <p className="mb-1 shrink-0 text-xs font-medium text-muted-foreground">
            {t('pages.listTitle', { defaultValue: 'Danh sách trang' })} ({pages.length})
          </p>

          {pages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t('pages.empty')}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleDragEnd(e)}
              >
                <SortableContext
                  items={pages.map((p) => p.key)}
                  strategy={rectSortingStrategy}
                >
                  <div className="flex flex-col gap-2.5 pb-2">
                    {pages.map((page, index) => (
                      <SortablePageCard
                        key={page.key}
                        pageKey={page.key}
                        previewUrl={page.previewUrl ?? ''}
                        index={index}
                        selected={selectedPageKeys.has(page.key)}
                        onToggleSelect={(key) => {
                          const next = new Set(selectedPageKeys)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          setSelectedPageKeys(next)
                        }}
                        onPreview={() => {
                          if (!page.previewUrl) return
                          setPreviewPage({ url: page.previewUrl, index })
                        }}
                        disabled={isBusy}
                        onRotate={async (degrees) => {
                          if (isHandling || !page.previewUrl) return
                          setIsHandling(true)
                          try {
                            await mutations.rotatePageMutation.mutateAsync({
                              docSlug: document.docSlug,
                              pageKey: page.key,
                              previewUrl: page.previewUrl,
                              degrees,
                            })
                            await mutations.assemblePdfMutation.mutateAsync({
                              docSlug: document.docSlug,
                              displayName: document.displayName,
                            })
                          } finally {
                            setIsHandling(false)
                          }
                        }}
                        onDelete={async () => {
                          if (isHandling) return
                          setIsHandling(true)
                          try {
                            await mutations.deletePageMutation.mutateAsync(page.key)
                            if (pages.length > 1) {
                              await mutations.assemblePdfMutation.mutateAsync({
                                docSlug: document.docSlug,
                                displayName: document.displayName,
                              })
                            }
                          } finally {
                            setIsHandling(false)
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* Modal Zoom Preview */}
      <Dialog
        open={previewPage !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPage(null)
        }}
      >
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-4 py-2.5">
            <DialogTitle className="text-sm font-semibold">
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