import { FileDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportFolderMetadataExcel } from '@/features/data-management/api/dossierClient'
import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { RecordDetailPanel } from '@/features/data-management/components/RecordDetailPanel'
import {
  canExportFolderMetadata,
  resolveFolderExportId,
} from '@/features/data-management/lib/treeUtils'
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
  const [isExporting, setIsExporting] = useState(false)
  const showExport = canExportFolderMetadata(node)

  async function handleExportFolder() {
    if (!showExport || isExporting) return

    setIsExporting(true)
    try {
      await exportFolderMetadataExcel(resolveFolderExportId(node), node.name)
      toast.success(t('recordDetail.exportExcelSuccess'))
    } catch {
      toast.error(t('recordDetail.exportExcelError'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card
      variant="detail"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CardHeader className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {node.name}
          </CardTitle>
          {showExport ? (
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() => void handleExportFolder()}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileDown className="size-4" aria-hidden />
              )}
              {isExporting
                ? t('recordDetail.exportExcelExporting')
                : t('recordDetail.exportExcel')}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <FolderContentList children={node.children} onSelect={onSelectNode} />
      </CardContent>
    </Card>
  )
}

export function DataNodeDetailPanel({
  node,

  role,

  dossierId,

  dossierStatus,

  focusDocumentId,

  focusGroupIndex,

  onFocusDocument,

  onSelectNode,

  onWorkflowComplete,
}: {
  node: DataTreeNodeT | null

  role: string

  dossierId?: string | null

  dossierStatus?: DataDossierStatus

  focusDocumentId?: string

  focusGroupIndex?: number

  onFocusDocument?: (documentId: string, groupIndex: number) => void

  onSelectNode: (id: string) => void

  onWorkflowComplete?: (dossierId: string) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')

  if (!node) {
    return (
      <Card variant="detail" className="flex min-h-0 flex-1 flex-col">
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <RecordDetailPanel
          node={node}
          role={role}
          dossierId={dossierId ?? node.dossierId ?? node.id}
          dossierStatus={dossierStatus ?? node.dossierStatus}
          focusDocumentId={focusDocumentId}
          focusGroupIndex={focusGroupIndex}
          onFocusDocument={onFocusDocument}
          onWorkflowComplete={onWorkflowComplete}
        />
      </CardContent>
    </Card>
  )
}
