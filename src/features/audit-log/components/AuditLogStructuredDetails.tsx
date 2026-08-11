import { useTranslation } from 'react-i18next'

type AuditLogStructuredDetailsProps = {
  requestBody: Record<string, unknown> | null
}

const DETAIL_FIELD_ORDER = [
  'statusChange',
  'fromStatus',
  'toStatus',
  'fileName',
  'sourceDossierName',
  'targetDossierName',
  'fromLocation',
  'toLocation',
  'fromDocumentType',
  'toDocumentType',
  'location',
  'dossierName',
  'dossierId',
  'fileId',
  'reportId',
  'documentTypeName',
  'documentTypeId',
  'securityLevelId',
  'movedCount',
  'deletedCount',
  'rejectNotes',
  'rejectFields',
  'approvedQcStep',
  'rejectedQcStep',
  'dossierStatus',
  'partial',
  'submittedCount',
  'failedCount',
  'targetUserLabel',
  'targetUserId',
  'active',
  'fromParentId',
  'toParentId',
  'physicalItemId',
  'projectCode',
  'sessionId',
  'roleId',
  'levelId',
  'name',
  'number',
  'code',
  'submissionYear',
] as const

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value
      .map((item) => {
        if (item && typeof item === 'object' && 'fileName' in item) {
          return String((item as { fileName?: string }).fileName ?? JSON.stringify(item))
        }
        return JSON.stringify(item)
      })
      .join(', ')
  }
  return JSON.stringify(value)
}

export function AuditLogStructuredDetails({
  requestBody,
}: AuditLogStructuredDetailsProps) {
  const { t } = useTranslation('audit-log')

  if (!requestBody) return null

  const entries = DETAIL_FIELD_ORDER
    .filter((key) => requestBody[key] !== undefined && requestBody[key] !== null)
    .map((key) => ({
      key,
      label: t(`detail.fields.${key}`, { defaultValue: key }),
      value: formatDetailValue(requestBody[key]),
    }))

  if (entries.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {t('detail.structuredDetails')}
      </h3>
      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.key} className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              {entry.label}
            </dt>
            <dd className="mt-1 text-sm break-words">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
