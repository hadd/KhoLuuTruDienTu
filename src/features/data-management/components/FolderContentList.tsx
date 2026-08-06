import { FileText, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DossierStatusBadge } from '@/features/data-management/components/DossierStatusBadge'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'

export function FolderContentList({
  children,
  onSelect,
}: {
  children: Array<DataTreeNodeT>
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('data-management')
  const lang = useCurrentLanguage()

  const hasStatus = children.some((c) => c.dossierStatus != null)

  if (children.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('folderList.empty')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">
                {t('folderList.columns.name')}
              </th>
              {hasStatus ? (
                <th className="px-3 py-2 font-medium text-muted-foreground">
                  {t('folderList.columns.status')}
                </th>
              ) : null}
              <th className="px-3 py-2 font-medium text-muted-foreground">
                {t('folderList.columns.size')}
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                {t('folderList.columns.uploadedAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {children.map((child) => {
              const Icon = child.type === 'document' ? FileText : Folder
              return (
                <tr
                  key={child.id}
                  className={cn(
                    'cursor-pointer border-b border-border transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => onSelect(child.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="truncate">{child.name}</span>
                      {child.type === 'document' && child.isSigned ? (
                        <span className="inline-flex shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          {t('tree.signed')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {hasStatus ? (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {child.dossierStatus ? (
                        <DossierStatusBadge status={child.dossierStatus} />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatFileSize(child.sizeBytes)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(child.uploadedAt, 'PP', lang)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
