import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bookmark,
  BookOpen,
  Loader2,
  PanelRight,
  PanelRightClose,
  Pencil,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  archiveBorrowAnnotationsQueryOptions,
  archiveBorrowKeys,
  archiveBorrowReadingProgressQueryOptions,
  createArchiveBorrowAnnotationMutationOptions,
  deleteArchiveBorrowAnnotationMutationOptions,
  updateArchiveBorrowAnnotationMutationOptions,
  upsertArchiveBorrowReadingProgressMutationOptions,
} from '@/features/archive-borrow/queries'
import type {
  ArchiveBorrowAnnotationT,
  ArchiveBorrowViewerFileT,
} from '@/features/archive-borrow/types'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

type ReaderTool = 'none' | 'note'

type ArchiveBorrowReaderPanelProps = {
  borrowId: string
  file: ArchiveBorrowViewerFileT | null
  pdfUrl: string | null
  expired: boolean
  initialPage?: number | null
  canWrite: boolean
  canOpenFlipbook?: boolean
  onOpenFlipbook?: () => void
}

export function ArchiveBorrowReaderPanel({
  borrowId,
  file,
  pdfUrl,
  expired,
  initialPage = null,
  canWrite,
  canOpenFlipbook = false,
  onOpenFlipbook,
}: ArchiveBorrowReaderPanelProps) {
  const { t } = useTranslation('archive-borrow')
  const { t: tWarehouse } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()
  const fileId = file?.fileId ?? null
  const [currentPage, setCurrentPage] = useState(1)
  const [scrollToPage, setScrollToPage] = useState<number | null>(null)
  const [tool, setTool] = useState<ReaderTool>('none')
  const [noteDraft, setNoteDraft] = useState('')
  const [pendingSelection, setPendingSelection] = useState<{
    page: number
    selectedText: string
    bbox: [number, number, number, number]
  } | null>(null)
  const [readerTab, setReaderTab] = useState<'bookmarks' | 'notes'>('bookmarks')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [showSidePanel, setShowSidePanel] = useState(true)
  const progressReadyRef = useRef(false)
  const lastSavedPageRef = useRef<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)

  const annotationsQuery = useQuery({
    ...archiveBorrowAnnotationsQueryOptions(borrowId, fileId),
    enabled: Boolean(borrowId && fileId && !expired),
  })

  const progressQuery = useQuery({
    ...archiveBorrowReadingProgressQueryOptions(borrowId, fileId),
    enabled: Boolean(borrowId && fileId && !expired),
  })

  const createMutation = useMutation({
    ...createArchiveBorrowAnnotationMutationOptions(borrowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...archiveBorrowKeys.all, 'annotations', borrowId],
      })
      await queryClient.invalidateQueries({
        queryKey: archiveBorrowKeys.readingSummary(),
      })
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.annotationFailed'))
    },
  })

  const deleteMutation = useMutation({
    ...deleteArchiveBorrowAnnotationMutationOptions(borrowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...archiveBorrowKeys.all, 'annotations', borrowId],
      })
      await queryClient.invalidateQueries({
        queryKey: archiveBorrowKeys.readingSummary(),
      })
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.annotationFailed'))
    },
  })

  const updateMutation = useMutation({
    ...updateArchiveBorrowAnnotationMutationOptions(borrowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...archiveBorrowKeys.all, 'annotations', borrowId],
      })
      await queryClient.invalidateQueries({
        queryKey: archiveBorrowKeys.readingSummary(),
      })
    },
    onError: (error) => {
      toast.error(translateError(error) || t('errors.annotationFailed'))
    },
  })

  const progressMutation = useMutation({
    ...upsertArchiveBorrowReadingProgressMutationOptions(borrowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...archiveBorrowKeys.all, 'reading-progress', borrowId],
      })
      await queryClient.invalidateQueries({
        queryKey: archiveBorrowKeys.readingSummary(),
      })
    },
  })

  useEffect(() => {
    progressReadyRef.current = false
    lastSavedPageRef.current = null
    setPendingSelection(null)
    setNoteDraft('')
    setEditingNoteId(null)
    setEditDraft('')
    setTool('none')
    setCurrentPage(1)
    setScrollToPage(null)
  }, [fileId])

  useEffect(() => {
    if (!fileId || progressReadyRef.current) return
    if (progressQuery.isLoading) return

    const savedPage = progressQuery.data?.[0]?.page
    const target =
      initialPage && initialPage > 0
        ? initialPage
        : savedPage && savedPage > 0
          ? savedPage
          : 1
    setCurrentPage(target)
    setScrollToPage(target)
    lastSavedPageRef.current = target
    progressReadyRef.current = true

    // Persist on open so ACTIVE borrows appear in "Đang đọc" without scrolling.
    if (canWrite && !expired) {
      progressMutation.mutate({ fileId, page: target })
    }
  }, [
    fileId,
    initialPage,
    progressQuery.data,
    progressQuery.isLoading,
    canWrite,
    expired,
    progressMutation,
  ])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current)
      }
    }
  }, [])

  const annotations = annotationsQuery.data ?? []
  const bookmarks = useMemo(
    () => annotations.filter((item) => item.kind === 'BOOKMARK'),
    [annotations],
  )
  const notes = useMemo(
    () => annotations.filter((item) => item.kind === 'NOTE'),
    [annotations],
  )

  function scheduleProgressSave(page: number) {
    if (!canWrite || !fileId || expired) return
    if (lastSavedPageRef.current === page) return
    if (progressTimerRef.current != null) {
      window.clearTimeout(progressTimerRef.current)
    }
    progressTimerRef.current = window.setTimeout(() => {
      lastSavedPageRef.current = page
      progressMutation.mutate({ fileId, page })
    }, 800)
  }

  function handleVisiblePageChange(page: number) {
    setCurrentPage(page)
    if (!progressReadyRef.current) return
    scheduleProgressSave(page)
  }

  async function handleAddBookmark() {
    if (!canWrite || !fileId) return
    try {
      await createMutation.mutateAsync({
        kind: 'BOOKMARK',
        fileId,
        page: currentPage,
        body: t('reader.bookmarkLabel', { page: currentPage }),
      })
      toast.success(t('reader.bookmarkAdded'))
      setReaderTab('bookmarks')
      setShowSidePanel(true)
    } catch {
      // toast in onError
    }
  }

  async function handleCreateNoteFromSelection() {
    if (!canWrite || !fileId || !pendingSelection) return
    try {
      await createMutation.mutateAsync({
        kind: 'NOTE',
        fileId,
        page: pendingSelection.page,
        bbox: pendingSelection.bbox,
        selectedText: pendingSelection.selectedText,
        body: noteDraft.trim() || pendingSelection.selectedText,
      })
      toast.success(t('reader.noteAdded'))
      setPendingSelection(null)
      setNoteDraft('')
      setTool('none')
      setReaderTab('notes')
      setShowSidePanel(true)
    } catch {
      // toast in onError
    }
  }

  async function handleAddPageNote() {
    if (!canWrite || !fileId) return
    const body = noteDraft.trim()
    if (!body) {
      toast.error(t('reader.noteRequired'))
      return
    }
    try {
      await createMutation.mutateAsync({
        kind: 'NOTE',
        fileId,
        page: currentPage,
        body,
      })
      toast.success(t('reader.noteAdded'))
      setNoteDraft('')
      setTool('none')
      setReaderTab('notes')
      setShowSidePanel(true)
    } catch {
      // toast in onError
    }
  }

  function jumpToAnnotation(item: ArchiveBorrowAnnotationT) {
    setCurrentPage(item.page)
    // Force PdfViewer scroll effect to re-run even when already on this page.
    setScrollToPage(null)
    requestAnimationFrame(() => {
      setScrollToPage(item.page)
    })
  }

  function handleStartEdit(item: ArchiveBorrowAnnotationT) {
    setEditingNoteId(item.id)
    setEditDraft(item.body || item.selectedText || '')
  }

  function handleCancelEdit() {
    setEditingNoteId(null)
    setEditDraft('')
  }

  async function handleSaveEdit() {
    if (!editingNoteId) return
    const body = editDraft.trim()
    if (!body) {
      toast.error(t('reader.noteRequired'))
      return
    }
    try {
      await updateMutation.mutateAsync({
        annotationId: editingNoteId,
        data: { body },
      })
      toast.success(t('reader.noteUpdated'))
      setEditingNoteId(null)
      setEditDraft('')
    } catch {
      // toast in onError
    }
  }

  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 gap-3 overflow-hidden',
        showSidePanel
          ? 'lg:grid-cols-[minmax(0,1fr)_260px]'
          : 'lg:grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
        {!expired && pdfUrl ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {file?.fileName ?? t('page.viewerFileMetadata')}
            </p>
            <span className="text-xs text-muted-foreground">
              {t('reader.pageLabel', { page: currentPage })}
            </span>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={createMutation.isPending}
                  onClick={() => void handleAddBookmark()}
                >
                  <Bookmark className="size-3.5" aria-hidden />
                  {t('reader.addBookmark')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tool === 'note' ? 'default' : 'outline'}
                  className="gap-1.5"
                  onClick={() =>
                    setTool((prev) => (prev === 'note' ? 'none' : 'note'))
                  }
                >
                  <StickyNote className="size-3.5" aria-hidden />
                  {t('reader.noteMode')}
                </Button>
              </>
            ) : null}
            {canOpenFlipbook && onOpenFlipbook ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onOpenFlipbook}
              >
                <BookOpen className="size-3.5" aria-hidden />
                {tWarehouse('detail.switchToFlipbook')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {tool === 'note' && canWrite ? (
          <div className="shrink-0 space-y-2 border-b bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('reader.noteHint')}</p>
            {pendingSelection ? (
              <div className="space-y-2">
                <p className="line-clamp-2 text-xs italic text-foreground">
                  “{pendingSelection.selectedText}”
                </p>
                <Textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder={t('reader.notePlaceholder')}
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={createMutation.isPending}
                    onClick={() => void handleCreateNoteFromSelection()}
                  >
                    {t('reader.saveNote')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPendingSelection(null)
                      setNoteDraft('')
                    }}
                  >
                    {t('reader.cancelSelection')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder={t('reader.pageNotePlaceholder', {
                    page: currentPage,
                  })}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={createMutation.isPending}
                  onClick={() => void handleAddPageNote()}
                >
                  {t('reader.saveNote')}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {expired ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {t('page.viewerExpired')}
          </div>
        ) : pdfUrl ? (
          <PdfViewer
            key={file?.fileId ?? 'none'}
            fileUrl={pdfUrl}
            fileName={file?.fileName}
            className="min-h-0 flex-1"
            showBorder={false}
            fitEdge
            scrollToPage={scrollToPage}
            onVisiblePageChange={handleVisiblePageChange}
            textSelectMode={canWrite && tool === 'note'}
            onTextSelect={(info) => {
              if (tool !== 'note') return
              setPendingSelection({
                page: info.pageNumber,
                selectedText: info.selectedText,
                bbox: info.bbox,
              })
              setNoteDraft((prev) => prev || info.selectedText)
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-muted-foreground">
              {t('page.viewerNoPdf')}
            </p>
          </div>
        )}
      </div>

      {showSidePanel ? (
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
          <Tabs
            value={readerTab}
            onValueChange={(value) => {
              if (value === 'bookmarks' || value === 'notes') {
                setReaderTab(value)
              }
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 items-center border-b">
              <TabsList className="grid h-auto min-w-0 flex-1 grid-cols-2 rounded-none bg-transparent p-0">
                <TabsTrigger value="bookmarks" className="rounded-none text-xs">
                  {t('reader.tabBookmarks')}
                </TabsTrigger>
                <TabsTrigger value="notes" className="rounded-none text-xs">
                  {t('reader.tabNotes')}
                </TabsTrigger>
              </TabsList>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 mr-1"
                onClick={() => setShowSidePanel(false)}
                aria-label={t('reader.hideSidePanel')}
                title={t('reader.hideSidePanel')}
              >
                <PanelRightClose className="size-3.5" aria-hidden />
              </Button>
            </div>

            {(['bookmarks', 'notes'] as const).map((tab) => {
              const items = tab === 'bookmarks' ? bookmarks : notes
              return (
                <TabsContent
                  key={tab}
                  value={tab}
                  className="mt-0 min-h-0 flex-1 overflow-y-auto p-2"
                >
                  {annotationsQuery.isLoading ? (
                    <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t('reader.loading')}
                    </div>
                  ) : items.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">
                      {t('reader.emptyList')}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((item) => {
                        const isEditingNote =
                          tab === 'notes' && editingNoteId === item.id
                        return (
                          <li key={item.id}>
                            <div
                              className={cn(
                                'group flex items-start gap-1 rounded-md border px-2 py-1.5',
                              )}
                            >
                              {isEditingNote ? (
                                <div className="min-w-0 flex-1 space-y-2">
                                  <p className="text-xs font-medium">
                                    {t('reader.pageLabel', { page: item.page })}
                                  </p>
                                  <Textarea
                                    value={editDraft}
                                    onChange={(event) =>
                                      setEditDraft(event.target.value)
                                    }
                                    placeholder={t('reader.notePlaceholder')}
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex flex-wrap gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={updateMutation.isPending}
                                      onClick={() => void handleSaveEdit()}
                                    >
                                      {t('reader.saveEdit')}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={updateMutation.isPending}
                                      onClick={handleCancelEdit}
                                    >
                                      {t('reader.cancelEdit')}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 text-left"
                                    onClick={() => jumpToAnnotation(item)}
                                  >
                                    <p className="text-xs font-medium">
                                      {t('reader.pageLabel', {
                                        page: item.page,
                                      })}
                                    </p>
                                    <p className="line-clamp-3 text-xs text-muted-foreground">
                                      {item.body ||
                                        item.selectedText ||
                                        t('reader.noContent')}
                                    </p>
                                  </button>
                                  {canWrite ? (
                                    <div className="flex shrink-0 items-start">
                                      {tab === 'notes' ? (
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="size-7 opacity-70 group-hover:opacity-100"
                                          disabled={
                                            updateMutation.isPending ||
                                            deleteMutation.isPending
                                          }
                                          onClick={() => handleStartEdit(item)}
                                          aria-label={t('reader.edit')}
                                        >
                                          <Pencil className="size-3.5" />
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="size-7 opacity-70 group-hover:opacity-100"
                                        disabled={deleteMutation.isPending}
                                        onClick={() => {
                                          if (editingNoteId === item.id) {
                                            handleCancelEdit()
                                          }
                                          deleteMutation.mutate(item.id)
                                        }}
                                        aria-label={t('reader.delete')}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </aside>
      ) : (
        <div className="hidden shrink-0 flex-col lg:flex">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            onClick={() => setShowSidePanel(true)}
            aria-label={t('reader.showSidePanel')}
            title={t('reader.showSidePanel')}
          >
            <PanelRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}
