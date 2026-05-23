import { useTranslation } from 'react-i18next'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { DataRecordStatusBadge } from '@/features/data-management/components/DataRecordStatusBadge'
import { DocumentMetadataForm } from '@/features/data-management/components/DocumentMetadataForm'
import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { RecordMetadataForm } from '@/features/data-management/components/RecordMetadataForm'
import type { DataTreeNodeT } from '@/features/data-management/types'

export function DataNodeDetailPanel({
  node,
  role,
  onSelectNode,
  onAdvance,
}: {
  node: DataTreeNodeT | null
  role: string
  onSelectNode: (id: string) => void
  onAdvance?: (id: string) => void
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

  if (node.type === 'document') {
    return (
      <Card
        variant="detail"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-0">
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-0 flex-1"
          >
            <ResizablePanel
              defaultSize={50}
              minSize={25}
              className="flex min-h-0 flex-col p-2"
            >
              {node.fields ? (
                <DocumentMetadataForm
                  fields={node.fields}
                  role={role}
                  onAdvance={() => onAdvance?.(node.id)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('detail.emptySelection')}
                </p>
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={50}
              minSize={25}
              className="flex min-h-0 flex-col overflow-hidden p-2"
            >
              {node.fileUrl ? (
                <PdfViewer
                  fileUrl={node.fileUrl}
                  fileName={node.name}
                  className="h-full min-h-[320px]"
                  showBorder={false}
                  fixedHeight={520}
                />
              ) : (
                <p className="p-3 text-sm text-muted-foreground">
                  {t('detail.emptySelection')}
                </p>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
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
          <FolderContentList
            children={node.children}
            onSelect={onSelectNode}
          />
        </CardContent>
      </Card>
    )
  }

  // record
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
      <CardHeader className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {node.name}
          </CardTitle>
          {node.recordStatus ? (
            <DataRecordStatusBadge status={node.recordStatus} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {node.fields ? (
          <RecordMetadataForm
            fields={node.fields}
            role={role}
            onAdvance={() => onAdvance?.(node.id)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('detail.emptySelection')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
