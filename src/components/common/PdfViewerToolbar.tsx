import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

export const PDF_ZOOM_MIN = 0.5
export const PDF_ZOOM_MAX = 3
export const PDF_ZOOM_STEP = 0.25

type PdfViewerToolbarProps = {
  className?: string
  currentPage: number
  numPages: number | null
  onGoToPage: (page: number) => void
  documentIndex: number
  documentCount: number
  onGoToDocument: (index: number) => void
  scale: number
  onScaleChange: (scale: number) => void
}

function clampPage(page: number, numPages: number): number {
  if (!Number.isFinite(page) || numPages < 1) return 1
  return Math.min(Math.max(Math.round(page), 1), numPages)
}

function clampScale(scale: number): number {
  const stepped = Math.round(scale / PDF_ZOOM_STEP) * PDF_ZOOM_STEP
  return Math.min(Math.max(stepped, PDF_ZOOM_MIN), PDF_ZOOM_MAX)
}

function ToolbarIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
}

export function PdfViewerToolbar({
  className,
  currentPage,
  numPages,
  onGoToPage,
  documentIndex,
  documentCount,
  onGoToDocument,
  scale,
  onScaleChange,
}: PdfViewerToolbarProps) {
  const { t } = useTranslation('data-management')
  const totalPages = numPages ?? 0
  const [pageDraft, setPageDraft] = useState(String(currentPage))

  useEffect(() => {
    setPageDraft(String(currentPage))
  }, [currentPage])

  const canNavigatePages = totalPages > 0
  const canGoPrevPage = canNavigatePages && currentPage > 1
  const canGoNextPage = canNavigatePages && currentPage < totalPages

  const canNavigateDocs = documentCount > 1
  const canGoPrevDoc = canNavigateDocs && documentIndex > 0
  const canGoNextDoc =
    canNavigateDocs && documentIndex >= 0 && documentIndex < documentCount - 1

  const canZoomOut = scale > PDF_ZOOM_MIN + 1e-6
  const canZoomIn = scale < PDF_ZOOM_MAX - 1e-6

  function commitPageDraft() {
    if (!canNavigatePages) {
      setPageDraft(String(currentPage))
      return
    }
    const parsed = Number.parseInt(pageDraft, 10)
    if (!Number.isFinite(parsed)) {
      setPageDraft(String(currentPage))
      return
    }
    const next = clampPage(parsed, totalPages)
    setPageDraft(String(next))
    if (next !== currentPage) onGoToPage(next)
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-0.5 rounded-md border border-border bg-muted/30 px-1 py-0.5',
        className,
      )}
    >
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.firstPage')}
        disabled={!canGoPrevPage}
        onClick={() => onGoToPage(1)}
      >
        <ChevronsLeft className="size-3.5" aria-hidden />
      </ToolbarIconButton>
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.prevPage')}
        disabled={!canGoPrevPage}
        onClick={() => onGoToPage(currentPage - 1)}
      >
        <ChevronLeft className="size-3.5" aria-hidden />
      </ToolbarIconButton>

      <div className="flex items-center gap-1 px-0.5">
        <Input
          type="text"
          inputMode="numeric"
          value={pageDraft}
          onChange={(event) => setPageDraft(event.target.value)}
          onBlur={commitPageDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitPageDraft()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
          disabled={!canNavigatePages}
          aria-label={t('recordDetail.pdfToolbar.pageInput')}
          className="h-7 w-10 px-1 text-center text-xs tabular-nums"
        />
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          / {totalPages || '—'}
        </span>
      </div>

      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.nextPage')}
        disabled={!canGoNextPage}
        onClick={() => onGoToPage(currentPage + 1)}
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </ToolbarIconButton>
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.lastPage')}
        disabled={!canGoNextPage}
        onClick={() => onGoToPage(totalPages)}
      >
        <ChevronsRight className="size-3.5" aria-hidden />
      </ToolbarIconButton>

      <ToolbarDivider />

      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.firstDocument')}
        disabled={!canGoPrevDoc}
        onClick={() => onGoToDocument(0)}
      >
        <ChevronsLeft className="size-3.5" aria-hidden />
      </ToolbarIconButton>
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.prevDocument')}
        disabled={!canGoPrevDoc}
        onClick={() => onGoToDocument(documentIndex - 1)}
      >
        <ChevronLeft className="size-3.5" aria-hidden />
      </ToolbarIconButton>

      <span
        className="min-w-[4.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground"
        title={t('recordDetail.pdfToolbar.documentLabel', {
          index: documentIndex >= 0 ? documentIndex + 1 : 0,
          total: documentCount,
        })}
      >
        {documentCount > 0 && documentIndex >= 0
          ? t('recordDetail.pdfToolbar.documentLabel', {
              index: documentIndex + 1,
              total: documentCount,
            })
          : t('recordDetail.pdfToolbar.noDocument')}
      </span>

      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.nextDocument')}
        disabled={!canGoNextDoc}
        onClick={() => onGoToDocument(documentIndex + 1)}
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </ToolbarIconButton>
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.lastDocument')}
        disabled={!canGoNextDoc}
        onClick={() => onGoToDocument(documentCount - 1)}
      >
        <ChevronsRight className="size-3.5" aria-hidden />
      </ToolbarIconButton>

      <ToolbarDivider />

      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.zoomOut')}
        disabled={!canZoomOut}
        onClick={() => onScaleChange(clampScale(scale - PDF_ZOOM_STEP))}
      >
        <ZoomOut className="size-3.5" aria-hidden />
      </ToolbarIconButton>
      <span className="min-w-[2.75rem] px-0.5 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <ToolbarIconButton
        label={t('recordDetail.pdfToolbar.zoomIn')}
        disabled={!canZoomIn}
        onClick={() => onScaleChange(clampScale(scale + PDF_ZOOM_STEP))}
      >
        <ZoomIn className="size-3.5" aria-hidden />
      </ToolbarIconButton>
    </div>
  )
}
