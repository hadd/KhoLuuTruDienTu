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
}: {
  node: DataTreeNodeT | null
  role: string
  onSelectNode: (id: string) => void
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-1">
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-0 flex-1 rounded-md border border-border bg-border p-px"
          >
            <ResizablePanel
              defaultSize={50}
              minSize={25}
              className="flex min-h-0 flex-col rounded-[calc(var(--radius)-4px)] bg-card p-1"
            >
              {node.fields ? (
                <DocumentMetadataForm fields={node.fields} role={role} />
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
              className="flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)-4px)] bg-card"
            >
              {node.fileUrl ? (
                <PdfViewer
                  fileUrl={node.fileUrl}
                  fileName={node.name}
                  className="h-full min-h-[320px] rounded-[calc(var(--radius)-4px)]"
                  showBorder={false}
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
          <RecordMetadataForm fields={node.fields} role={role} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('detail.emptySelection')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
