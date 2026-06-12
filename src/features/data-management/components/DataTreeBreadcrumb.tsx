import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import type { DataManagementSearch } from '@/features/data-management/schemas'
import { getPathToNode } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

type SearchShape = DataManagementSearch

export function DataTreeBreadcrumb({
  tree,
  nodeId,
}: {
  tree: DataTreeNodeT
  nodeId: string | undefined
  role?: DataManagementRole
}) {
  const { t } = useTranslation('data-management')
  const path = nodeId ? getPathToNode(tree, nodeId) : []

  const visiblePath =
    path.length > 0 && path[0].id === DATA_TREE_ROOT_ID ? path.slice(1) : path

  if (visiblePath.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        <span className="truncate font-medium text-foreground">{t('breadcrumb.root', 'Kho dữ liệu')}</span>
      </nav>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      {visiblePath.map((node, index) => {
        const isLast = index === visiblePath.length - 1
        const label = node.name

        return (
          <Fragment key={node.id}>
            {index > 0 ? (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            {isLast ? (
              <span className="truncate font-medium text-foreground">{label}</span>
            ) : (
              <Link
                to="."
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
