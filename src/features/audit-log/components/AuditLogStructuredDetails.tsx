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
  'movedCount',
  'deletedCount',
  'rejectNotes',
  'name',
  'number',
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
    <div>
      <dt className="mb-2 text-muted-foreground">{t('detail.structuredDetails')}</dt>
      <dd>
        <dl className="space-y-2 rounded-md bg-muted p-3 text-sm">
          {entries.map((entry) => (
            <div key={entry.key}>
              <dt className="text-muted-foreground">{entry.label}</dt>
              <dd className="break-words">{entry.value}</dd>
            </div>
          ))}
        </dl>
      </dd>
    </div>
  )
}
