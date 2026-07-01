import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScanDocumentPanel } from '@/features/document-scan/components/ScanDocumentPanel'
import { findNodeById } from '@/features/document-scan/lib/scanTreeUtils'
import type {
  ScanTreeNodeT,
  ScanWorkspaceT,
} from '@/features/document-scan/types'

interface ScanDetailPanelProps {
  workspace: ScanWorkspaceT
  selectedId?: string
  pageId?: string
  onSelectPage: (pageId: string) => void
  onClearPageSelection: () => void
  onEditNode: (node: ScanTreeNodeT) => void
  onDeleteNode: (node: ScanTreeNodeT) => void
}

export function ScanDetailPanel({
  workspace,
  selectedId,
  pageId,
  onSelectPage,
  onClearPageSelection,
  onEditNode,
  onDeleteNode,
}: ScanDetailPanelProps) {
  const { t } = useTranslation('document-scan')
  const selectedNode = selectedId ? findNodeById(workspace, selectedId) : null

  if (!selectedNode) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('detail.selectNode')}
        </p>
      </div>
    )
  }

  if (selectedNode.type === 'document') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <ScanDocumentPanel
          workspace={workspace}
          document={selectedNode}
          selectedPageId={pageId}
          onSelectPage={onSelectPage}
          onEditDocument={() => onEditNode(selectedNode)}
          onDeleteDocument={() => onDeleteNode(selectedNode)}
          onPageDeleted={onClearPageSelection}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <Card variant="detail">
        <CardHeader>
          <CardTitle>{selectedNode.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t(`nodeTypes.${selectedNode.type}`)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
