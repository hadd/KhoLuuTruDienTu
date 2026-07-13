import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { physicalWarehouseTreeQueryOptions } from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseLevelT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'

interface WarehouseDiagramTabProps {
  rootId: string
  levels: Array<PhysicalWarehouseLevelT>
}

function DiagramNode({
  node,
  levels,
  depth,
}: {
  node: PhysicalWarehouseTreeNodeT
  levels: Array<PhysicalWarehouseLevelT>
  depth: number
}) {
  const { t } = useTranslation('physical-warehouse')
  const level = levels.find((l) => l.id === node.levelId)
  const label = level?.levelName ?? t('manage.locationLabel')

  return (
    <div className="space-y-2" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <Card className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{node.name}</div>
        {node.address ? (
          <div className="text-xs text-muted-foreground">{node.address}</div>
        ) : null}
        {node.capacity != null ? (
          <div className="text-xs text-muted-foreground">
            {t('manage.usedCapacity', { used: 0, total: node.capacity })}
          </div>
        ) : null}
        {node.childCount > 0 ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {t('diagram.childCount', { count: node.childCount })}
          </div>
        ) : null}
      </Card>
      {node.children.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {node.children.map((child) => (
            <DiagramNode
              key={child.id}
              node={child}
              levels={levels}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function WarehouseDiagramTab({
  rootId,
  levels,
}: WarehouseDiagramTabProps) {
  const { t } = useTranslation('physical-warehouse')
  const { data: tree, isPending } = useQuery(
    physicalWarehouseTreeQueryOptions(rootId),
  )

  if (isPending) {
    return <p className="text-sm text-muted-foreground">...</p>
  }

  if (!tree || tree.children.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t('diagram.empty')}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {tree.children.map((child) => (
        <DiagramNode
          key={child.id}
          node={child}
          levels={levels}
          depth={0}
        />
      ))}
    </div>
  )
}
