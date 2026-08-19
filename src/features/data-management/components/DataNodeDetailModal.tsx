import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import { RecordWorkflowSection } from '@/features/data-management/components/RecordWorkflowSection'
import {
  isDossierWorkflowNode,
  resolveDossierUpdateId,
  resolveRecordDossierId,
} from '@/features/data-management/lib/treeUtils'
import { dossierWorkflowAssignmentsQueryOptions } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'

function resolveDetailModalDossierId(node: DataTreeNodeT): string | null {
  if (node.type === 'record') {
    return resolveRecordDossierId(node)
  }
  if (isDossierWorkflowNode(node)) {
    return resolveDossierUpdateId(node) ?? node.dossierId ?? null
  }
  return null
}

export function DataNodeDetailModal({
  node,
  open,
  onOpenChange,
}: {
  node: DataTreeNodeT | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('data-management')
  const lang = useCurrentLanguage()

  const dossierId = useMemo(
    () => (node ? resolveDetailModalDossierId(node) : null),
    [node],
  )

  const workflowQuery = useQuery({
    ...dossierWorkflowAssignmentsQueryOptions(dossierId ?? ''),
    enabled: open && Boolean(dossierId?.trim()),
  })

  if (!node) return null

  const showWorkflow = Boolean(dossierId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="truncate">{node.name}</DialogTitle>
            {node.dossierStatus ? (
              <DossierStatusBadge status={node.dossierStatus} />
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('detail.type')}</dt>
              <dd className="font-medium text-foreground">
                {t(`nodeType.${node.type}` as const)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.size')}</dt>
              <dd className="font-medium text-foreground">
                {formatFileSize(node.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.uploadedAt')}</dt>
              <dd className="font-medium text-foreground">
                {formatDate(node.uploadedAt, 'PPp', lang)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.uploadedBy')}</dt>
              <dd className="font-medium text-foreground">{node.uploadedBy}</dd>
            </div>
          </dl>

          {showWorkflow ? (
            <RecordWorkflowSection
              data={workflowQuery.data}
              isLoading={workflowQuery.isLoading}
              isError={workflowQuery.isError}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
