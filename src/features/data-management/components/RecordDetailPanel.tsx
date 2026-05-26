import { FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { buildMetadataFieldValues } from '@/features/data-management/lib/metadataDate'
import type {
  DataDocumentFieldT,
  DataMetadataGroupT,
  DataTreeNodeT,
} from '@/features/data-management/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

function MetadataGroupSection({
  group,
  role,
  onFieldHighlight,
  highlightedFieldName,
}: {
  group: DataMetadataGroupT
  role: string
  onFieldHighlight?: (field: DataDocumentFieldT) => void
  highlightedFieldName?: string | null
}) {
  const { t } = useTranslation('data-management')
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildMetadataFieldValues(group.fields),
  )
  const isReadOnly = role === 'editor' || role === 'qc'
  const sourceFileName = group.source_document?.file_name

  return (
    <Card variant="bordered" className="overflow-hidden">
      <CardHeader className="space-y-1 px-4 py-3">
        <CardTitle className="text-base">{group.group_name}</CardTitle>
        {sourceFileName ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{sourceFileName}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {group.fields.length > 0 ? (
          group.fields.map((field, index) => (
            <MetadataFieldInput
              key={`${group.group_code}-${field.name}`}
              field={field}
              value={values[field.name] ?? ''}
              onChange={(value) =>
                setValues((prev) => ({ ...prev, [field.name]: value }))
              }
              onHighlight={onFieldHighlight}
              isHighlighted={highlightedFieldName === field.name}
              disabled={isReadOnly}
              index={index}
              idPrefix={`group-${group.group_code}`}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('recordDetail.noFields')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function RecordDetailPanel({
  node,
  role,
  onSelectNode,
  onFieldHighlight,
  highlightedFieldName,
}: {
  node: DataTreeNodeT
  role: string
  onSelectNode: (id: string) => void
  onFieldHighlight?: (field: DataDocumentFieldT) => void
  highlightedFieldName?: string | null
}) {
  const { t } = useTranslation('data-management')
  const metadata = node.dossierMetadata
  const documents = useMemo(
    () => node.children.filter((child) => child.type === 'document'),
    [node.children],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {metadata ? (
        <Card variant="bordered">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">
              {t('recordDetail.summaryTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {metadata.ho_so_id ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t('recordDetail.hoSoId')}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {metadata.ho_so_id}
                </p>
              </div>
            ) : null}
            {metadata.trang_thai_ho_so ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t('recordDetail.trangThaiHoSo')}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {metadata.trang_thai_ho_so}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {metadata?.metadata_groups?.length ? (
        <div className="space-y-3">
          <h3 className={cn('text-sm font-medium text-foreground')}>
            {t('recordDetail.documentsTitle')}
          </h3>
          {metadata.metadata_groups.map((group) => (
            <MetadataGroupSection
              key={group.group_code}
              group={group}
              role={role}
              onFieldHighlight={onFieldHighlight}
              highlightedFieldName={highlightedFieldName}
            />
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {t('recordDetail.fileListTitle')}
          </h3>
          <FolderContentList children={documents} onSelect={onSelectNode} />
        </div>
      ) : null}

      {!metadata && documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('detail.emptySelection')}
        </p>
      ) : null}
    </div>
  )
}
