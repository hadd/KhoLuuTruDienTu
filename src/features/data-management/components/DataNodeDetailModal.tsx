import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataRecordStatusBadge } from '@/features/data-management/components/DataRecordStatusBadge'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'

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

  if (!node) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate">{node.name}</DialogTitle>
            {node.type === 'record' && node.recordStatus ? (
              <DataRecordStatusBadge status={node.recordStatus} />
            ) : null}
          </div>
        </DialogHeader>

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
          {node.type === 'record' && node.editor ? (
            <div>
              <dt className="text-muted-foreground">{t('detail.editor')}</dt>
              <dd className="font-medium text-foreground">
                {node.editor.name}
              </dd>
            </div>
          ) : null}
          {node.type === 'record' && node.reviewer1 ? (
            <div>
              <dt className="text-muted-foreground">{t('detail.reviewer1')}</dt>
              <dd className="font-medium text-foreground">
                {node.reviewer1.name}
              </dd>
            </div>
          ) : null}
          {node.type === 'record' && node.reviewer2 ? (
            <div>
              <dt className="text-muted-foreground">{t('detail.reviewer2')}</dt>
              <dd className="font-medium text-foreground">
                {node.reviewer2.name}
              </dd>
            </div>
          ) : null}
          {node.type === 'record' && node.reviewer3 ? (
            <div>
              <dt className="text-muted-foreground">{t('detail.reviewer3')}</dt>
              <dd className="font-medium text-foreground">
                {node.reviewer3.name}
              </dd>
            </div>
          ) : null}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
