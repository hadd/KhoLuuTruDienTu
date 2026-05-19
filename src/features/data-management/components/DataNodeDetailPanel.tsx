import { useTranslation } from 'react-i18next'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DataRecordStatusBadge } from '@/features/data-management/components/DataRecordStatusBadge'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'

export function DataNodeDetailPanel({ node }: { node: DataTreeNodeT | null }) {
  const { t } = useTranslation('data-management')
  const lang = useCurrentLanguage()

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
          {node.type === 'record' && node.recordStatus ? (
            <DataRecordStatusBadge status={node.recordStatus} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <dl className="grid shrink-0 gap-2 text-sm sm:grid-cols-2">
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

        {node.type === 'document' && node.fileUrl ? (
          <>
            <Separator />
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {t('preview.title')}
              </p>
              <div className="min-h-0 flex-1 overflow-hidden">
                <PdfViewer
                  fileUrl={node.fileUrl}
                  fileName={node.name}
                  className="h-full min-h-[320px]"
                />
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
