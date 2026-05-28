import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PdfViewer } from '@/components/common/PdfViewer'
import type { PdfFieldHighlight } from '@/components/common/PdfViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import { DocumentMetadataForm } from '@/features/data-management/components/DocumentMetadataForm'
import { RecordDetailPanel } from '@/features/data-management/components/RecordDetailPanel'
import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { resolveDocumentFileRef } from '@/features/data-management/lib/metadataHelpers'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

function fieldToHighlight(field: DataDocumentFieldT): PdfFieldHighlight | null {
  if (field.bbox.length !== 4 || field.page < 1) return null
  return {
    page: field.page,
    bbox: field.bbox as [number, number, number, number],
  }
}

export function DataNodeDetailPanel({
  node,
  role,
  dossierId,
  dossierMetadata,
  dossierStatus,
  isLastDocument = false,
  onSelectNode,
  onAdvance,
  onComplete,
}: {
  node: DataTreeNodeT | null
  role: string
  dossierId?: string | null
  dossierMetadata?: DataDossierMetadataT
  dossierStatus?: DataDossierStatus
  isLastDocument?: boolean
  onSelectNode: (id: string) => void
  onAdvance?: (id: string) => void
  onComplete?: (id: string) => void
}) {
  const { t } = useTranslation('data-management')
  const [pdfHighlight, setPdfHighlight] = useState<PdfFieldHighlight | null>(null)
  const [highlightedFieldName, setHighlightedFieldName] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setPdfHighlight(null)
    setHighlightedFieldName(null)
  }, [node?.id])

  function handleFieldHighlight(field: DataDocumentFieldT) {
    const next = fieldToHighlight(field)
    if (!next) return
    setPdfHighlight(next)
    setHighlightedFieldName(field.name)
  }

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
              <DocumentMetadataForm
                dossierId={dossierId ?? node.parentId ?? node.id}
                dossierMetadata={dossierMetadata}
                documentName={node.name}
                documentFileRef={resolveDocumentFileRef(node)}
                fields={node.fields ?? []}
                role={role}
                dossierStatus={dossierStatus}
                isLastDocument={isLastDocument}
                onAdvance={() => onAdvance?.(node.id)}
                onFieldHighlight={handleFieldHighlight}
                highlightedFieldName={highlightedFieldName}
              />
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
                  highlight={pdfHighlight}
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
          {node.dossierStatus ? (
            <DossierStatusBadge status={node.dossierStatus} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <RecordDetailPanel
          node={node}
          role={role}
          dossierId={node.dossierId ?? node.id}
          onSelectNode={onSelectNode}
        />
      </CardContent>
    </Card>
  )
}
