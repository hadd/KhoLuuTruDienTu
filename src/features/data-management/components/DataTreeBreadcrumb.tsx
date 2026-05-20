import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { MOCK_DATA_ROOT_ID } from '@/features/data-management/lib/mockData'
import { getPathToNode } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

type SearchShape = { q?: string; nodeId?: string }

export function DataTreeBreadcrumb({
  tree,
  nodeId,
}: {
  tree: DataTreeNodeT
  nodeId: string | undefined
}) {
  const { t } = useTranslation('data-management')
  const path = nodeId ? getPathToNode(tree, nodeId) : []

  if (path.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      {path.map((node, index) => {
        const isLast = index === path.length - 1
        const label =
          node.id === MOCK_DATA_ROOT_ID ? t('breadcrumb.root') : node.name

        return (
          <Fragment key={node.id}>
            {index > 0 ? (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            {isLast ? (
              <span className="truncate font-medium text-foreground">{label}</span>
            ) : (
              <Link
                to="/admin/data"
                search={(prev: SearchShape) => ({
                  ...prev,
                  nodeId: node.id,
                })}
                className={cn(
                  'truncate text-muted-foreground transition-colors hover:text-foreground',
                  'max-w-[12rem] sm:max-w-xs',
                )}
              >
                {label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
