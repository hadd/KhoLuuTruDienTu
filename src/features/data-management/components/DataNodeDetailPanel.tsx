import { FileDown } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExportChoiceDialog } from '@/features/data-management/components/ExportChoiceDialog'
import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { RecordDetailPanel } from '@/features/data-management/components/RecordDetailPanel'
import type { ExportMode } from '@/features/data-management/lib/exportHelpers'
import {
  canExportNode,
  resolveDossierIdForDip,
  resolveExportContext,
  runExport,
} from '@/features/data-management/lib/exportHelpers'
import type {
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

function FolderDetailCard({
  node,
  onSelectNode,
}: {
  node: DataTreeNodeT
  onSelectNode: (id: string) => void
}) {
  const { t } = useTranslation('data-management')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingMode, setExportingMode] = useState<ExportMode | null>(null)
  const [canExportDip, setCanExportDip] = useState(false)

  const showExport = canExportNode(node)
  const exportContext = showExport ? resolveExportContext(node) : null

  useEffect(() => {
    if (!dialogOpen || !exportContext) {
      setCanExportDip(Boolean(exportContext?.dossierId))
      return
    }

    let cancelled = false
    async function resolveDip() {
      if (!exportContext) return
      const dossierId = await resolveDossierIdForDip(exportContext)
      if (!cancelled) {
        setCanExportDip(Boolean(dossierId))
        if (dossierId && !exportContext.dossierId) {
          exportContext.dossierId = dossierId
        }
      }
    }
    void resolveDip()
    return () => {
      cancelled = true
    }
  }, [dialogOpen, exportContext])

  const handleExport = useCallback(
    async (mode: ExportMode, options?: { presetId?: string }) => {
      if (!exportContext || isExporting) return

      setIsExporting(true)
      setExportingMode(mode)
      try {
        let dossierId = exportContext.dossierId
        if (mode === 'dip' && !dossierId) {
          dossierId = await resolveDossierIdForDip(exportContext)
        }
        await runExport({
          kind: exportContext.kind,
          mode,
          folderId: exportContext.folderId,
          dossierId,
          downloadName: exportContext.downloadName,
          metadataExportConfig: options?.presetId
            ? { presetId: options.presetId }
            : undefined,
        })
        toast.success(t('recordDetail.exportExcelSuccess'))
        setDialogOpen(false)
      } catch {
        toast.error(t('recordDetail.exportExcelError'))
      } finally {
        setIsExporting(false)
        setExportingMode(null)
      }
    },
    [exportContext, isExporting, t],
  )

  return (
    <>
      <Card
        variant="detail"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <CardHeader className="shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="min-w-0 flex-1 truncate text-lg"></CardTitle>
            {showExport ? (
              <Button
                type="button"
                className="shrink-0 gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <FileDown className="size-4" aria-hidden />
                {t('recordDetail.exportExcel')}
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <FolderContentList children={node.children} onSelect={onSelectNode} />
        </CardContent>
      </Card>

      <ExportChoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={exportContext}
        canExportDip={canExportDip}
        onExport={handleExport}
        isExporting={isExporting}
        exportingMode={exportingMode}
      />
    </>
  )
}

export function DataNodeDetailPanel({
  node,

  role,

  dossierId,

  dossierStatus,

  isEditorDraftView = false,

  focusDocumentId,

  focusGroupIndex,

  onFocusDocument,

  onSelectNode,

  onWorkflowComplete,

  onDigitalSignCompleted,
}: {
  node: DataTreeNodeT | null

  role: string

  dossierId?: string | null

  dossierStatus?: DataDossierStatus

  isEditorDraftView?: boolean

  focusDocumentId?: string

  focusGroupIndex?: number

  onFocusDocument?: (documentId: string, groupIndex: number) => void

  onSelectNode: (id: string) => void

  onWorkflowComplete?: (
    dossierId: string,
    mode?: 'draft' | 'final' | 'error_report',
  ) => void | Promise<void>
  onDigitalSignCompleted?: (dossierId: string) => void
}) {
  const { t } = useTranslation('data-management')

  if (!node) {
    return (
      <Card variant="detail" className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 items-center justify-center py-12">
          <p className="text-center text-sm text-muted-foreground">
            {t('detail.emptySelection')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (node.type === 'folder') {
    return <FolderDetailCard node={node} onSelectNode={onSelectNode} />
  }

  if (node.parentId === null) {
    return (
      <Card
        variant="detail"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <CardHeader className="shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="min-w-0 flex-1 truncate text-lg">
              {t('breadcrumb.root')}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <FolderContentList children={node.children} onSelect={onSelectNode} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      variant="detail"
      className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <CardContent className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden p-0">
        <RecordDetailPanel
          node={node}
          role={role}
          dossierId={dossierId ?? node.dossierId ?? node.id}
          dossierStatus={dossierStatus ?? node.dossierStatus}
          isEditorDraftView={isEditorDraftView}
          focusDocumentId={focusDocumentId}
          focusGroupIndex={focusGroupIndex}
          onFocusDocument={onFocusDocument}
          onWorkflowComplete={onWorkflowComplete}
          onDigitalSignCompleted={onDigitalSignCompleted}
        />
      </CardContent>
    </Card>
  )
}
