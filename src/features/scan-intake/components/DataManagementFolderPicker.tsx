import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import {
  dataManagementTreeQueryOptions,
  useLoadNodeChildrenMutation,
} from '@/features/data-management/queries'
import { findNodeById } from '@/features/data-management/lib/treeUtils'
import {
  findNodeByFolderPath,
  resolvePromoteTargetFolderPath,
} from '@/features/scan-intake/lib/findNodeByFolderPath'

interface DataManagementFolderPickerProps {
  projectCode: string
  value?: string
  onValueChange: (folderPath: string) => void
}

export function DataManagementFolderPicker({
  projectCode,
  value,
  onValueChange,
}: DataManagementFolderPickerProps) {
  const { t } = useTranslation('scan-intake')
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const {
    data: tree,
    isPending,
    isError,
    refetch,
  } = useQuery(dataManagementTreeQueryOptions('admin', projectCode))

  const loadChildren = useLoadNodeChildrenMutation('admin', projectCode)

  useEffect(() => {
    if (!tree || !value) {
      setSelectedId(undefined)
      return
    }
    const node = findNodeByFolderPath(tree, value)
    setSelectedId(node?.id)
  }, [tree, value])

  function handleSelect(id: string) {
    if (!tree) return
    const node = findNodeById(tree, id)
    if (!node) return

    const folderPath = resolvePromoteTargetFolderPath(node)
    if (!folderPath) {
      setSelectedId(id)
      toast.message(t('promote.selectFolderOnly'))
      return
    }

    setSelectedId(id)
    onValueChange(folderPath)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('promote.targetFolderLabel')}</p>

      {isPending ? (
        <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('promote.loadingFolders')}
        </div>
      ) : isError ? (
        <div className="space-y-2 rounded-md border border-destructive/40 p-4 text-sm">
          <p className="text-destructive">{t('promote.loadFoldersFailed')}</p>
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => void refetch()}
          >
            {t('promote.retryLoadFolders')}
          </button>
        </div>
      ) : tree ? (
        <DataFolderTree
          tree={tree}
          selectedId={selectedId}
          onSelect={handleSelect}
          onExpandNode={(id) => {
            void loadChildren.mutateAsync(id)
          }}
          className="max-h-72"
        />
      ) : null}

      {value ? (
        <p className="text-xs text-muted-foreground break-all">
          {t('promote.selectedPath')}: {value}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('promote.selectFolderHint')}</p>
      )}
    </div>
  )
}
