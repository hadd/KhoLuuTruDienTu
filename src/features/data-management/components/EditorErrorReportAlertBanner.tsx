import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { EditorErrorReportT } from '@/features/data-management/types'

export function EditorErrorReportAlertBanner({
  report,
  pendingCount,
  alertKey,
  onViewDetails,
}: {
  report?: EditorErrorReportT | null
  pendingCount?: number
  alertKey:
    | 'editorErrorReport.alert.pendingForQc'
    | 'editorErrorReport.alert.pendingForQcMultiple'
    | 'editorErrorReport.alert.pendingForManager'
    | 'editorErrorReport.alert.rejected'
  onViewDetails?: () => void
}) {
  const { t } = useTranslation('data-management')
  const count = pendingCount ?? (report ? 1 : 0)

  const alertMessage =
    alertKey === 'editorErrorReport.alert.pendingForQcMultiple' && count > 1
      ? t(alertKey, { count })
      : t(
          alertKey === 'editorErrorReport.alert.pendingForQcMultiple'
            ? 'editorErrorReport.alert.pendingForQc'
            : alertKey,
        )

  return (
    <div className="shrink-0 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-destructive">{alertMessage}</p>
          {alertKey === 'editorErrorReport.alert.rejected' &&
          report?.rejectNote?.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {report.rejectNote.trim()}
            </p>
          ) : null}
          {onViewDetails ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewDetails}
            >
              {t('editorErrorReport.review.viewDetails')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
