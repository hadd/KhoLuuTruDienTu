import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseTreeQueryOptions,
  useReparentPhysicalWarehouseItem,
} from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseStatsT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

interface WarehouseDiagramTabProps {
  rootId: string
  warehouseId?: string
  stats?: PhysicalWarehouseStatsT | null
  compact?: boolean
}

const BOX_DRAG_PREFIX = 'box:'
const PARENT_DROP_PREFIX = 'parent:'

type BoxMoveController = {
  canMove: boolean
  movingBox: PhysicalWarehouseTreeNodeT | null
  onSelectBox: (box: PhysicalWarehouseTreeNodeT) => void
  onDropToParent: (parentId: string) => void
  onCancel: () => void
}

function getActiveMovingBox(
  move: BoxMoveController,
): PhysicalWarehouseTreeNodeT | null {
  return move.movingBox
}

function canDropOnParent(
  move: BoxMoveController,
  parentId: string,
): boolean {
  const box = getActiveMovingBox(move)
  return Boolean(box) && box.parentId !== parentId
}

function useParentDropZone(parentId: string, move: BoxMoveController) {
  const isDropTarget = canDropOnParent(move, parentId)
  const { setNodeRef, isOver } = useDroppable({
    id: `${PARENT_DROP_PREFIX}${parentId}`,
    data: { type: 'parent', parentId },
    disabled: !move.canMove,
  })

  return { setNodeRef, isOver, isDropTarget }
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

function UnitChip({
  node,
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  move: BoxMoveController
}) {
  const { t } = useTranslation('physical-warehouse')
  const used = node.usedCapacity ?? 0
  const total = node.capacity
  const hasCapacity = total != null
  const isMoving = move.movingBox?.id === node.id
  const selectable = move.canMove && hasCapacity
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${BOX_DRAG_PREFIX}${node.id}`,
    data: { type: 'box', node },
    disabled: !selectable,
  })

  return (
    <div
      ref={setNodeRef}
      {...(selectable ? listeners : {})}
      {...(selectable ? attributes : {})}
      role="button"
      tabIndex={selectable ? 0 : undefined}
      aria-disabled={!selectable && !isMoving}
      className={cn(
        'inline-flex min-w-[4.5rem] touch-none flex-col items-center justify-center rounded-md border px-2 py-1 text-left transition-colors select-none',
        hasCapacity ? fillTone(used, total) : 'border-border bg-background',
        selectable && 'cursor-grab hover:ring-2 hover:ring-primary/40 active:cursor-grabbing',
        (isMoving || isDragging) && 'opacity-50 ring-2 ring-primary',
        move.movingBox && !isMoving && !isDragging && 'opacity-80',
        !selectable && !isMoving && 'cursor-default opacity-60',
      )}
      title={
        selectable
          ? t('diagram.moveBoxHint')
          : node.name
      }
      onClick={(event) => {
        event.stopPropagation()
        if (!selectable) return
        if (move.movingBox?.id === node.id) {
          move.onCancel()
          return
        }
        move.onSelectBox(node)
      }}
      onKeyDown={(event) => {
        if (!selectable) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          if (move.movingBox?.id === node.id) {
            move.onCancel()
            return
          }
          move.onSelectBox(node)
        }
      }}
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
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  rowLevelName: string
  unitLevelName: string
  move: BoxMoveController
}) {
  const { t } = useTranslation('physical-warehouse')
  const { setNodeRef, isOver, isDropTarget } = useParentDropZone(node.id, move)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'grid grid-cols-1 items-stretch gap-2 border-b border-border/60 py-1.5 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]',
        (isDropTarget || isOver) &&
          'cursor-pointer rounded-md bg-primary/5 ring-1 ring-primary/30 hover:bg-primary/10',
        isOver && 'bg-primary/10 ring-2 ring-primary/50',
      )}
      onClick={() => {
        if (isDropTarget) move.onDropToParent(node.id)
      }}
      onKeyDown={(event) => {
        if (isDropTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          move.onDropToParent(node.id)
        }
      }}
      role={isDropTarget ? 'button' : undefined}
      tabIndex={isDropTarget ? 0 : undefined}
    >
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
          {isDropTarget ? (
            <span className="ml-1 text-primary">
              · {t('diagram.dropHere')}
            </span>
          ) : null}
        </div>
      </div>
      <ChipTray>
        {node.children.length === 0 ? (
          <span className="px-1 py-0.5 text-xs text-muted-foreground">—</span>
        ) : (
          node.children.map((child) => (
            <UnitChip key={child.id} node={child} move={move} />
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
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  floorLevelName: string
  rowLevelName: string
  unitLevelName: string
  defaultOpen?: boolean
  move: BoxMoveController
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
                move={move}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function BuildingHeader({ node }: { node: PhysicalWarehouseTreeNodeT }) {
  const { t } = useTranslation('physical-warehouse')
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <Building2 className="size-4 shrink-0 text-primary" />
      <h3 className="text-sm font-semibold leading-none">{node.name}</h3>
      {node.address ? (
        <span className="text-xs text-muted-foreground">{node.address}</span>
      ) : null}
      {node.mapsUrl ? (
        <a
          href={node.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t('manage.viewOnMap')}
          aria-label={t('manage.viewOnMap')}
          className="text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <MapPin className="size-3.5" />
        </a>
      ) : null}
      <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {node.childCount}
      </span>
    </div>
  )
}

function isStorageUnitNode(node: {
  parentId: string | null
  capacity: number | null
}): boolean {
  return node.parentId != null && node.capacity != null
}

function subtreeDepth(node: PhysicalWarehouseTreeNodeT): number {
  if (node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map((child) => subtreeDepth(child)))
}

function RackCard({
  node,
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  move: BoxMoveController
}) {
  const { t } = useTranslation('physical-warehouse')
  const { setNodeRef, isOver, isDropTarget: canDrop } = useParentDropZone(
    node.id,
    move,
  )
  const isDropTarget = canDrop && !isStorageUnitNode(node)

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'overflow-hidden',
        isDropTarget &&
          'cursor-pointer ring-2 ring-primary/40 hover:bg-primary/5',
        isOver && 'bg-primary/5 ring-primary/60',
      )}
      variant="list"
      onClick={() => {
        if (isDropTarget) move.onDropToParent(node.id)
      }}
    >
      <BuildingHeader node={node} />
      <div className="p-2">
        {isDropTarget ? (
          <p className="mb-2 text-xs text-primary">{t('diagram.dropHere')}</p>
        ) : null}
        <ChipTray>
          {node.children.map((child) =>
            isStorageUnitNode(child) ? (
              <UnitChip key={child.id} node={child} move={move} />
            ) : (
              <span
                key={child.id}
                className="rounded border px-2 py-1 text-[11px] text-muted-foreground"
              >
                {child.name}
              </span>
            ),
          )}
        </ChipTray>
      </div>
    </Card>
  )
}

function BuildingBlock({
  node,
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  move: BoxMoveController
}) {
  const { t } = useTranslation('physical-warehouse')
  const depth = subtreeDepth(node)
  const storageLabel = t('manage.storageUnitLabel')
  const intermediateLabel = t('manage.intermediateLabel')

  if (isStorageUnitNode(node) || depth === 0) {
    return (
      <Card className="overflow-hidden" variant="list">
        <BuildingHeader node={node} />
        <div className="p-2">
          <ChipTray>
            {isStorageUnitNode(node) ? (
              <UnitChip node={node} move={move} />
            ) : (
              <span className="px-1 py-0.5 text-xs text-muted-foreground">—</span>
            )}
          </ChipTray>
        </div>
      </Card>
    )
  }

  // depth 1: building → chips (storage units)
  if (depth === 1) {
    return <RackCard node={node} move={move} />
  }

  // depth 2: building → rows → chips
  if (depth === 2) {
    return (
      <Card className="overflow-hidden" variant="list">
        <BuildingHeader node={node} />
        <div className="px-2.5 py-0.5">
          {node.children.map((child) => (
            <RowBlock
              key={child.id}
              node={child}
              rowLevelName={intermediateLabel}
              unitLevelName={storageLabel}
              move={move}
            />
          ))}
        </div>
      </Card>
    )
  }

  // depth 3+: building → floors → nested
  return (
    <Card className="overflow-hidden" variant="list">
      <BuildingHeader node={node} />
      <div className="space-y-2 p-2">
        {node.children.map((child) => (
          <FloorOrNested
            key={child.id}
            node={child}
            floorLevelName={intermediateLabel}
            rowLevelName={intermediateLabel}
            unitLevelName={storageLabel}
            move={move}
          />
        ))}
      </div>
    </Card>
  )
}

function FloorOrNested({
  node,
  floorLevelName,
  rowLevelName,
  unitLevelName,
  move,
}: {
  node: PhysicalWarehouseTreeNodeT
  floorLevelName: string
  rowLevelName: string
  unitLevelName: string
  move: BoxMoveController
}) {
  const depth = subtreeDepth(node)

  if (isStorageUnitNode(node) || depth === 0) {
    return (
      <ChipTray>
        {isStorageUnitNode(node) ? (
          <UnitChip node={node} move={move} />
        ) : (
          <span className="px-1 py-0.5 text-xs text-muted-foreground">
            {node.name}
          </span>
        )}
      </ChipTray>
    )
  }

  if (depth === 1) {
    return (
      <RowBlock
        node={node}
        rowLevelName={rowLevelName}
        unitLevelName={unitLevelName}
        move={move}
      />
    )
  }

  if (depth === 2) {
    return (
      <FloorBlock
        node={node}
        floorLevelName={floorLevelName}
        rowLevelName={rowLevelName}
        unitLevelName={unitLevelName}
        move={move}
      />
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>/</span>
        <span>{node.name}</span>
        <span className="font-normal normal-case">{floorLevelName}</span>
      </div>
      {node.children.map((child) => (
        <FloorOrNested
          key={child.id}
          node={child}
          floorLevelName={floorLevelName}
          rowLevelName={rowLevelName}
          unitLevelName={unitLevelName}
          move={move}
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
  warehouseId,
  stats,
  compact = false,
}: WarehouseDiagramTabProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageWarehouseContents } = usePhysicalWarehouseAccess()
  const reparentMutation = useReparentPhysicalWarehouseItem()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [movingBox, setMovingBox] =
    useState<PhysicalWarehouseTreeNodeT | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
  )

  function handleDropToParent(parentId: string) {
    if (!movingBox) return
    if (movingBox.parentId === parentId) {
      setMovingBox(null)
      return
    }
    const box = movingBox
    reparentMutation.mutate(
      { itemId: box.id, newParentId: parentId },
      { onSuccess: () => setMovingBox(null) },
    )
  }

  const move: BoxMoveController = {
    canMove: canManageWarehouseContents,
    movingBox,
    onSelectBox: (box) => setMovingBox(box),
    onDropToParent: handleDropToParent,
    onCancel: () => setMovingBox(null),
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.type === 'box' && data.node) {
      setMovingBox(data.node as PhysicalWarehouseTreeNodeT)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const activeData = active.data.current
    const overData = over?.data.current

    if (
      overData?.type === 'parent' &&
      activeData?.type === 'box' &&
      activeData.node
    ) {
      const box = activeData.node as PhysicalWarehouseTreeNodeT
      const parentId = overData.parentId as string
      if (box.parentId !== parentId) {
        reparentMutation.mutate(
          { itemId: box.id, newParentId: parentId },
          { onSuccess: () => setMovingBox(null) },
        )
        return
      }
    }

    setMovingBox(null)
  }

  const { data: tree, isPending } = useQuery(
    physicalWarehouseTreeQueryOptions(rootId),
  )

  const filteredRoots = useMemo(() => {
    if (!tree) return []
    const q = query.trim()
    const nodes = warehouseId
      ? tree.children.filter((child) => child.id === warehouseId)
      : tree.children
    return nodes
      .map((child) => filterTree(child, q))
      .filter((child): child is PhysicalWarehouseTreeNodeT => child != null)
  }, [tree, query, warehouseId])

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
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        compact ? 'gap-2' : 'gap-3',
      )}
    >
      <form
        className="flex shrink-0 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(draft.trim())
        }}
      >
        <Input
          className={compact ? 'h-8 max-w-sm flex-1 text-sm' : 'h-9 max-w-xs'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('diagram.searchPlaceholder')}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className={compact ? 'h-8 px-2.5' : undefined}
        >
          <Search className={compact ? 'size-3.5' : 'mr-1 size-3.5'} />
          {!compact ? t('diagram.search') : null}
          {compact ? (
            <span className="sr-only">{t('diagram.search')}</span>
          ) : null}
        </Button>
      </form>

      {movingBox ? (
        <Card className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-primary/40 bg-primary/5 p-2.5">
          <p className="text-sm">
            {t('diagram.movingBanner', { name: movingBox.name })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setMovingBox(null)}
          >
            <X className="mr-1 size-3.5" />
            {t('diagram.cancelMove')}
          </Button>
        </Card>
      ) : !compact && canManageWarehouseContents ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          {t('diagram.moveHint')}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setMovingBox(null)}
      >
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {filteredRoots.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">
                {t('diagram.noSearchResult')}
              </Card>
            ) : (
              filteredRoots.map((node) => (
                <BuildingBlock key={node.id} node={node} move={move} />
              ))
            )}
          </div>

          {stats ? <OverviewSidebar stats={stats} /> : null}
        </div>

        <DragOverlay dropAnimation={null}>
          {movingBox ? (
            <div className="inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded-md border border-primary/40 bg-background px-2 py-1 shadow-lg">
              <span className="max-w-[6.5rem] truncate text-[11px] font-semibold">
                {movingBox.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
