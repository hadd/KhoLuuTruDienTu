import type { JSONContent } from '@tiptap/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  downloadDisposalDocumentDraftDocx,
  getDisposalDocumentDraft,
  regenerateDisposalDocumentDraft,
  saveDisposalDocumentDraft,
  uploadDisposalDocumentDraftDocx,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import { DocumentRichTextEditor } from '@/features/archive-disposal/components/DocumentRichTextEditor'
import type { EditableDocumentSlugT } from '@/features/archive-disposal/types'
import { translateError } from '@/lib/utils/translate-error'

export type DisposalDocumentEditorPageProps = {
  catalogId: string
  slug: EditableDocumentSlugT
  titleKey: string
  canEdit: boolean
  /** When opened via window.open — close the browser window after save/close. */
  closeBrowserWindowOnExit?: boolean
  onSaved?: () => void
}

export function DisposalDocumentEditorPage({
  catalogId,
  slug,
  titleKey,
  canEdit,
  closeBrowserWindowOnExit = false,
  onSaved,
}: DisposalDocumentEditorPageProps) {
  const { t } = useTranslation('archive-disposal')
  const queryClient = useQueryClient()
  const [content, setContent] = useState<JSONContent | null>(null)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const docxInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = t(titleKey)
  }, [t, titleKey])

  const draftQuery = useQuery({
    queryKey: ['disposal-document-draft', catalogId, slug],
    queryFn: () => getDisposalDocumentDraft(catalogId, slug),
    enabled: Boolean(catalogId),
  })

  const displayContent = content ?? draftQuery.data?.contentJson ?? null

  const exitEditor = () => {
    if (closeBrowserWindowOnExit) {
      window.close()
      return
    }
    onSaved?.()
  }

  const saveMutation = useMutation({
    mutationFn: () => saveDisposalDocumentDraft(catalogId, slug, displayContent!),
    onSuccess: () => {
      toast.success(t('documentEditor.saveSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['disposal-document-draft', catalogId, slug] })
      onSaved?.()
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateDisposalDocumentDraft(catalogId, slug),
    onSuccess: (data) => {
      setContent(data.contentJson)
      toast.success(t('documentEditor.regenerateSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['disposal-document-draft', catalogId, slug] })
      setRegenerateOpen(false)
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const uploadDocxMutation = useMutation({
    mutationFn: (file: File) => uploadDisposalDocumentDraftDocx(catalogId, slug, file),
    onSuccess: () => {
      toast.success(t('documentEditor.uploadDocxSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['disposal-document-draft', catalogId, slug] })
      if (docxInputRef.current) docxInputRef.current.value = ''
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const handleDownloadDocx = async () => {
    try {
      await downloadDisposalDocumentDraftDocx(catalogId, slug)
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-semibold text-lg">{t(titleKey)}</h1>
          {draftQuery.data?.sourceStale ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('documentEditor.sourceStale')}</p>
          ) : null}
        </div>
      </header>

      <Tabs defaultValue="web" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit shrink-0">
          <TabsTrigger value="web">{t('documentEditor.tabWeb')}</TabsTrigger>
          <TabsTrigger value="word">{t('documentEditor.tabWord')}</TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          {draftQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('documentEditor.loading')}
            </div>
          ) : displayContent ? (
            <DocumentRichTextEditor
              className="min-h-0 flex-1"
              content={displayContent}
              editable={canEdit}
              placeholder={t('documentEditor.placeholder')}
              onContentChange={setContent}
            />
          ) : (
            <p className="px-6 py-8 text-sm text-destructive">{t('documentEditor.loadFailed')}</p>
          )}
        </TabsContent>

        <TabsContent value="word" className="mt-0 space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-sm text-muted-foreground">{t('documentEditor.wordHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handleDownloadDocx()}>
              <Download className="mr-2 size-4" />
              {t('documentEditor.downloadDocx')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canEdit || uploadDocxMutation.isPending}
              onClick={() => docxInputRef.current?.click()}
            >
              {uploadDocxMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {t('documentEditor.uploadDocx')}
            </Button>
            <input
              ref={docxInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadDocxMutation.mutate(file)
              }}
            />
          </div>
          {draftQuery.data?.hasUploadedDocx ? (
            <p className="text-sm text-green-700 dark:text-green-300">{t('documentEditor.hasUploadedDocx')}</p>
          ) : null}
        </TabsContent>
      </Tabs>

      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit || regenerateMutation.isPending}
          onClick={() => setRegenerateOpen(true)}
        >
          {t('documentEditor.regenerate')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={exitEditor}>
            {t('documentEditor.close')}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              disabled={!displayContent || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t('documentEditor.save')}
            </Button>
          ) : null}
        </div>
      </footer>

      <AlertDialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentEditor.regenerateConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('documentEditor.regenerateConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('documentEditor.close')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={regenerateMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                regenerateMutation.mutate()
              }}
            >
              {t('documentEditor.regenerate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function buildDisposalDocumentEditorUrl(
  catalogId: string,
  slug: EditableDocumentSlugT,
  options?: { canEdit?: boolean; titleKey?: string },
): string {
  const params = new URLSearchParams()
  if (options?.canEdit === false) params.set('canEdit', '0')
  if (options?.titleKey) params.set('titleKey', options.titleKey)
  const qs = params.toString()
  return `/app/archive-warehouse/document-editor/${encodeURIComponent(catalogId)}/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
}

export function openDisposalDocumentEditorWindow(
  catalogId: string,
  slug: EditableDocumentSlugT,
  options?: { canEdit?: boolean; titleKey?: string },
): Window | null {
  const url = buildDisposalDocumentEditorUrl(catalogId, slug, options)
  const features = [
    'popup=yes',
    `width=${Math.min(1280, screen.availWidth)}`,
    `height=${Math.min(900, screen.availHeight)}`,
    `left=${Math.max(0, Math.round((screen.availWidth - 1280) / 2))}`,
    `top=${Math.max(0, Math.round((screen.availHeight - 900) / 2))}`,
  ].join(',')
  return window.open(url, `disposal-doc-editor-${catalogId}-${slug}`, features)
}
