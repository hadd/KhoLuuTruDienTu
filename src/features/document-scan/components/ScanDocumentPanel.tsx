import { Loader2, Pencil, ScanLine, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScanPageEditor } from '@/features/document-scan/components/ScanPageEditor'
import { ScanPageReorderList } from '@/features/document-scan/components/ScanPageReorderList'
import { useScanner } from '@/features/document-scan/hooks/useScanner'
import { generatePdfFromImages } from '@/features/document-scan/lib/generatePdfFromImages'
import { getPagesForDocument } from '@/features/document-scan/lib/scanTreeUtils'
import {
  useAddScanPagesMutation,
  useDeleteScanNodeMutation,
  useReorderScanPagesMutation,
} from '@/features/document-scan/queries'
import type {
  ScanDocumentT,
  ScanWorkspaceT,
} from '@/features/document-scan/types'

interface ScanDocumentPanelProps {
  workspace: ScanWorkspaceT
  document: ScanDocumentT
  selectedPageId?: string
  onSelectPage: (pageId: string) => void
  onEditDocument: () => void
  onDeleteDocument: () => void
  onPageDeleted?: () => void
}

export function ScanDocumentPanel({
  workspace,
  document,
  selectedPageId,
  onSelectPage,
  onEditDocument,
  onDeleteDocument,
  onPageDeleted,
}: ScanDocumentPanelProps) {
  const { t } = useTranslation('document-scan')
  const { scan, pickFiles } = useScanner()
  const addPages = useAddScanPagesMutation()
  const reorderPages = useReorderScanPagesMutation()
  const deleteNode = useDeleteScanNodeMutation()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const pdfUrlRef = useRef<string | null>(null)

  const pages = useMemo(
    () => getPagesForDocument(workspace, document.id),
    [workspace, document.id],
  )

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  useEffect(() => {
    if (selectedPage) {
      setEditorOpen(true)
    }
  }, [selectedPage?.id])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        if (pages.length === 0) {
          if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
            pdfUrlRef.current = null
          }
          setPdfUrl(null)
          return
        }

        setIsGeneratingPdf(true)
        try {
          const blob = await generatePdfFromImages(pages)
          if (cancelled) return

          if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
          }

          const nextUrl = URL.createObjectURL(blob)
          pdfUrlRef.current = nextUrl
          setPdfUrl(nextUrl)
        } finally {
          if (!cancelled) {
            setIsGeneratingPdf(false)
          }
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pages])

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current)
      }
    }
  }, [])

  const handleScan = async (mode: 'scan' | 'pick') => {
    const result = mode === 'scan' ? await scan() : await pickFiles()
    if (result.files.length === 0) return
    await addPages.mutateAsync({ documentId: document.id, files: result.files })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {document.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('detail.pageCount', { count: pages.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="gap-2"
                disabled={addPages.isPending}
              >
                <ScanLine className="size-4" />
                {t('actions.scan')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleScan('scan')}>
                {t('scan.mockScan')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleScan('pick')}>
                {t('scan.pickFiles')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditDocument}
          >
            <Pencil className="size-4" />
            {t('actions.edit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDeleteDocument}
            disabled={deleteNode.isPending}
          >
            <Trash2 className="size-4" />
            {t('actions.delete')}
          </Button>
        </div>
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-md border border-border bg-muted">
        {isGeneratingPdf ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {pdfUrl ? (
          <PdfViewer
            fileUrl={pdfUrl}
            fileName={document.name}
            fixedHeight={320}
          />
        ) : (
          <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('detail.noPages')}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          {t('detail.documentPages')}
        </h3>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noPages')}</p>
        ) : (
          <ScanPageReorderList
            pages={pages}
            selectedPageId={selectedPageId}
            onSelectPage={(pageId) => {
              onSelectPage(pageId)
              setEditorOpen(true)
            }}
            onDeletePage={(pageId) => {
              if (selectedPageId === pageId) {
                onPageDeleted?.()
              }
            }}
            onReorder={(orderedPageIds) => {
              void reorderPages.mutateAsync({
                documentId: document.id,
                orderedPageIds,
              })
            }}
          />
        )}
      </div>

      <ScanPageEditor
        page={selectedPage}
        open={editorOpen && Boolean(selectedPage)}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            onPageDeleted?.()
          }
        }}
        onDeleted={onPageDeleted}
      />
    </div>
  )
}
