import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FolderContentList } from '@/features/data-management/components/FolderContentList'
import { RecordMetadataSection } from '@/features/data-management/components/RecordMetadataSection'
import type { DataTreeNodeT } from '@/features/data-management/types'

export function RecordDetailPanel({
  node,
  role,
  dossierId,
  onSelectNode,
}: {
  node: DataTreeNodeT
  role: string
  dossierId: string
  onSelectNode: (id: string) => void
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
        <RecordMetadataSection
          metadata={metadata}
          role={role}
          dossierId={dossierId}
          dossierStatus={node.dossierStatus}
        />
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
