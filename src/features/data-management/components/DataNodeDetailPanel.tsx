import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { RecordDetailPanel } from '@/features/data-management/components/RecordDetailPanel'

import { FolderContentList } from '@/features/data-management/components/FolderContentList'

import type {
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

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
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <FolderContentList children={node.children} onSelect={onSelectNode} />
        </CardContent>
      </Card>
    )
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
