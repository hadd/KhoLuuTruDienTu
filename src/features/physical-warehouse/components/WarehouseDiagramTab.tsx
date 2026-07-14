import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { physicalWarehouseTreeQueryOptions } from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseLevelT,
  PhysicalWarehouseStatsT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

interface WarehouseDiagramTabProps {
  rootId: string
  levels: Array<PhysicalWarehouseLevelT>
  stats?: PhysicalWarehouseStatsT | null
}

function matchesQuery(node: PhysicalWarehouseTreeNodeT, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  if (node.name.toLowerCase().includes(needle)) return true
  if (node.address?.toLowerCase().includes(needle)) return true
  return node.children.some((child) => matchesQuery(child, q))
}

function filterTree(
  node: PhysicalWarehouseTreeNodeT,
  q: string,
): PhysicalWarehouseTreeNodeT | null {
  if (!q) return node
  if (!matchesQuery(node, q)) return null
  const children = node.children
    .map((child) => filterTree(child, q))
    .filter((child): child is PhysicalWarehouseTreeNodeT => child != null)
  const selfMatch =
    node.name.toLowerCase().includes(q.toLowerCase()) ||
    Boolean(node.address?.toLowerCase().includes(q.toLowerCase()))
  if (!selfMatch && children.length === 0) return null
  return { ...node, children, childCount: children.length }
}

function fillTone(used: number, total: number): string {
  if (total <= 0) return 'border-border bg-background'
  const ratio = used / total
  if (ratio >= 1) return 'border-destructive/40 bg-destructive/5'
  if (ratio >= 0.8) return 'border-amber-500/40 bg-amber-500/5'
  if (ratio > 0) return 'border-emerald-500/40 bg-emerald-500/5'
  return 'border-border bg-background'
}

function capacityBarClass(used: number, total: number): string {
  const ratio = total > 0 ? used / total : 0
  if (ratio >= 1) return 'bg-destructive'
  if (ratio >= 0.8) return 'bg-amber-500'
  if (ratio > 0) return 'bg-emerald-500'
  return 'bg-muted-foreground/25'
}

function UnitChip({ node }: { node: PhysicalWarehouseTreeNodeT }) {
  const { t } = useTranslation('physical-warehouse')
  const used = 0
  const total = node.capacity
  const hasCapacity = total != null

  return (
    <div
      className={cn(
        'inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded-md border px-2 py-1',
        hasCapacity ? fillTone(used, total) : 'border-border bg-background',
      )}
      title={node.name}
    >
      <span className="max-w-[6.5rem] truncate text-[11px] font-semibold leading-tight">
        {node.name}
      </span>
      <span className="mt-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {hasCapacity
          ? t('manage.usedCapacity', { used, total })
          : t('diagram.childCount', { count: node.childCount })}
      </span>
      {hasCapacity ? (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              capacityBarClass(used, total),
            )}
            style={{
              width: `${Math.min(100, (used / total) * 100)}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function ChipTray({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-9 flex-wrap content-start gap-1.5 rounded-md border border-dashed border-border/80 bg-muted/30 p-1.5">
      {children}
    </div>
  )
}

function RowBlock({
  node,
  rowLevelName,
  unitLevelName,
}: {
  node: PhysicalWarehouseTreeNodeT
  rowLevelName: string
  unitLevelName: string
}) {
  const { t } = useTranslation('physical-warehouse')

  return (
    <div className="grid grid-cols-1 items-stretch gap-2 border-b border-border/60 py-1.5 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col justify-center gap-0.5 sm:pr-1">
        <div className="truncate text-sm font-semibold leading-tight">
          {node.name}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {node.children.length > 0
            ? t('diagram.levelCount', {
                count: node.children.length,
                level: unitLevelName || rowLevelName,
              })
            : rowLevelName}
        </div>
      </div>
      <ChipTray>
        {node.children.length === 0 ? (
          <span className="px-1 py-0.5 text-xs text-muted-foreground">—</span>
        ) : (
          node.children.map((child) => (
            <UnitChip key={child.id} node={child} />
          ))
        )}
      </ChipTray>
    </div>
  )
}

function FloorBlock({
  node,
  floorLevelName,
  rowLevelName,
  unitLevelName,
  defaultOpen = true,
}: {
  node: PhysicalWarehouseTreeNodeT
  floorLevelName: string
  rowLevelName: string
  unitLevelName: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 bg-muted/50 px-2.5 py-1.5 text-left hover:bg-muted/70"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">/</span>
        <span className="text-xs font-bold uppercase tracking-wide">
          {node.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {floorLevelName}
        </span>
        <span className="ml-auto rounded bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {node.childCount}
        </span>
      </button>
      {open ? (
        <div className="px-2.5 py-0.5">
          {node.children.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">—</p>
          ) : (
            node.children.map((child) => (
              <RowBlock
                key={child.id}
                node={child}
                rowLevelName={rowLevelName}
                unitLevelName={unitLevelName}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function BuildingHeader({ node }: { node: PhysicalWarehouseTreeNodeT }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <Building2 className="size-4 shrink-0 text-primary" />
      <h3 className="text-sm font-semibold leading-none">{node.name}</h3>
      {node.address ? (
        <span className="text-xs text-muted-foreground">{node.address}</span>
      ) : null}
      <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {node.childCount}
      </span>
    </div>
  )
}

function BuildingBlock({
  node,
  levels,
  minOrder,
  maxOrder,
}: {
  node: PhysicalWarehouseTreeNodeT
  levels: Array<PhysicalWarehouseLevelT>
  minOrder: number
  maxOrder: number
}) {
  const levelById = useMemo(
    () => new Map(levels.map((l) => [l.id, l])),
    [levels],
  )
  const nodeLevel = node.levelId ? levelById.get(node.levelId) : undefined
  const order = nodeLevel?.levelOrder ?? minOrder
  const unitLevel = levels.find((l) => l.levelOrder === maxOrder)
  const rowLevel = levels.find((l) => l.levelOrder === maxOrder - 1)
  const floorLevel = levels.find((l) => l.levelOrder === order + 1)

  // 1 level only
  if (maxOrder === minOrder) {
    return (
      <Card className="overflow-hidden" variant="list">
        <BuildingHeader node={node} />
        <div className="p-2">
          <ChipTray>
            <UnitChip node={node} />
          </ChipTray>
        </div>
      </Card>
    )
  }

  // 2 levels: building → chips
  if (maxOrder - minOrder === 1) {
    return (
      <Card className="overflow-hidden" variant="list">
        <BuildingHeader node={node} />
        <div className="p-2">
          <ChipTray>
            {node.children.map((child) => (
              <UnitChip key={child.id} node={child} />
            ))}
          </ChipTray>
        </div>
      </Card>
    )
  }

  // 3 levels: building → rows → chips
  if (maxOrder - minOrder === 2) {
    return (
      <Card className="overflow-hidden" variant="list">
        <BuildingHeader node={node} />
        <div className="px-2.5 py-0.5">
          {node.children.map((child) => (
            <RowBlock
              key={child.id}
              node={child}
              rowLevelName={rowLevel?.levelName ?? ''}
              unitLevelName={unitLevel?.levelName ?? ''}
            />
          ))}
        </div>
      </Card>
    )
  }

  // 4+ levels: building → floors → rows → chips
  return (
    <Card className="overflow-hidden" variant="list">
      <BuildingHeader node={node} />
      <div className="space-y-2 p-2">
        {node.children.map((child) => (
          <FloorOrNested
            key={child.id}
            node={child}
            levels={levels}
            floorLevelName={floorLevel?.levelName ?? ''}
            rowLevelName={rowLevel?.levelName ?? ''}
            unitLevelName={unitLevel?.levelName ?? ''}
            maxOrder={maxOrder}
          />
        ))}
      </div>
    </Card>
  )
}

function FloorOrNested({
  node,
  levels,
  floorLevelName,
  rowLevelName,
  unitLevelName,
  maxOrder,
}: {
  node: PhysicalWarehouseTreeNodeT
  levels: Array<PhysicalWarehouseLevelT>
  floorLevelName: string
  rowLevelName: string
  unitLevelName: string
  maxOrder: number
}) {
  const level = levels.find((l) => l.id === node.levelId)
  const order = level?.levelOrder ?? 0

  if (order === maxOrder - 1) {
    return (
      <RowBlock
        node={node}
        rowLevelName={rowLevelName}
        unitLevelName={unitLevelName}
      />
    )
  }

  if (
    order === maxOrder - 2 ||
    node.children.every((c) => {
      const childLevel = levels.find((l) => l.id === c.levelId)
      return (childLevel?.levelOrder ?? 0) >= maxOrder - 1
    })
  ) {
    return (
      <FloorBlock
        node={node}
        floorLevelName={floorLevelName || level?.levelName || ''}
        rowLevelName={rowLevelName}
        unitLevelName={unitLevelName}
      />
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>/</span>
        <span>{node.name}</span>
        <span className="font-normal normal-case">
          {level?.levelName}
        </span>
      </div>
      {node.children.map((child) => (
        <FloorOrNested
          key={child.id}
          node={child}
          levels={levels}
          floorLevelName={floorLevelName}
          rowLevelName={rowLevelName}
          unitLevelName={unitLevelName}
          maxOrder={maxOrder}
        />
      ))}
    </div>
  )
}

function OverviewSidebar({ stats }: { stats: PhysicalWarehouseStatsT }) {
  const { t } = useTranslation('physical-warehouse')
  const bottomLevel = stats.levelStats.at(-1)

  return (
    <Card className="h-fit space-y-2.5 p-3 lg:sticky lg:top-4">
      <h3 className="text-sm font-semibold">{t('diagram.overview')}</h3>
      <div className="space-y-1.5">
        {stats.levelStats.map((levelStat) => (
          <div
            key={levelStat.levelId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-muted-foreground">{levelStat.levelName}</span>
            <span className="font-semibold tabular-nums">{levelStat.count}</span>
          </div>
        ))}
        <div className="space-y-1.5 border-t pt-2">
          {bottomLevel ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {t('diagram.bottomTotal', { level: bottomLevel.levelName })}
              </span>
              <span className="font-semibold tabular-nums">
                {bottomLevel.count}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t('stats.fillRate')}</span>
            <span className="font-semibold tabular-nums">{stats.fillRate}%</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t('stats.overloaded')}</span>
            <span className="font-semibold tabular-nums">
              {stats.overloadedCount}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function WarehouseDiagramTab({
  rootId,
  levels,
  stats,
}: WarehouseDiagramTabProps) {
  const { t } = useTranslation('physical-warehouse')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.levelOrder - b.levelOrder),
    [levels],
  )
  const minOrder = sortedLevels[0]?.levelOrder ?? 1
  const maxOrder = sortedLevels.at(-1)?.levelOrder ?? 1

  const { data: tree, isPending } = useQuery(
    physicalWarehouseTreeQueryOptions(rootId),
  )

  const filteredRoots = useMemo(() => {
    if (!tree) return []
    const q = query.trim()
    return tree.children
      .map((child) => filterTree(child, q))
      .filter((child): child is PhysicalWarehouseTreeNodeT => child != null)
  }, [tree, query])

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
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(draft.trim())
        }}
      >
        <Input
          className="h-9 max-w-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('diagram.searchPlaceholder')}
        />
        <Button type="submit" variant="secondary" size="sm">
          <Search className="mr-1 size-3.5" />
          {t('diagram.search')}
        </Button>
      </form>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-3">
          {filteredRoots.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              {t('diagram.noSearchResult')}
            </Card>
          ) : (
            filteredRoots.map((node) => (
              <BuildingBlock
                key={node.id}
                node={node}
                levels={sortedLevels}
                minOrder={minOrder}
                maxOrder={maxOrder}
              />
            ))
          )}
        </div>

        {stats ? <OverviewSidebar stats={stats} /> : null}
      </div>
    </div>
  )
}
