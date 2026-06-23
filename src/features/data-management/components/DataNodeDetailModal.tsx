import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import { getActiveCheckerLevel } from '@/features/data-management/lib/checkerAssignmentHelpers'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { useTranslation } from 'react-i18next'

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

  const activeCheckerLevel = getActiveCheckerLevel(node.dossierStatus)
  const checkerAssignments = node.checkerAssignments ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate">{node.name}</DialogTitle>
            {node.dossierStatus ? (
              <DossierStatusBadge status={node.dossierStatus} />
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
          {node.type === 'record' && checkerAssignments.length > 0
            ? checkerAssignments.map((assignment) => {
                const isActive = activeCheckerLevel === assignment.level

                return (
                  <div
                    key={assignment.role}
                    className={cn(
                      'sm:col-span-2 rounded-md border border-border p-3',
                      isActive && 'border-primary bg-primary/5',
                    )}
                  >
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <span>
                        {t('detail.checkerLevel', { level: assignment.level })}
                      </span>
                      {isActive ? (
                        <Badge variant="outline" className="text-xs">
                          {t('detail.checkerActive')}
                        </Badge>
                      ) : null}
                    </dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {assignment.assignees.map((assignee) => (
                        <Badge key={assignee.id} variant="secondary">
                          {assignee.name}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )
              })
            : null}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
