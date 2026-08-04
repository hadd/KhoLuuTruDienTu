// WarehouseDiagramTab.tsx
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { physicalWarehouseTreeQueryOptions } from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseStatsT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

/* ================= HẰNG SỐ VẼ ================= */
const M = 22
const ROW_W = 1.1 * M
const BAY_H = 1.2 * M
const GAP = 3
const AISLE = 2.0 * M
const LEFT = 24
const TOP = 12
const TITLE_H = 26
const ZONE_NAME_H = 26
const ROW_LABEL_H = 26
const FLOOR = '#d8d8d8'

const E_UP_W = 6
const E_COL_W = 64
const E_LEVEL_H = 46
const E_BOX_H = 26
const E_PALLET_H = 5
const E_BEAM_H = 6
const E_LEFT = 24
const E_TOP = 24
const E_RIGHT = 90
const E_BOTTOM = 46

/* ================= HELPERS ================= */
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

function collectLeaves(
  node: PhysicalWarehouseTreeNodeT,
): Array<PhysicalWarehouseTreeNodeT> {
  if (isStorageUnitNode(node)) return [node]
  return node.children.flatMap(collectLeaves)
}

function usageFill(used: number, total: number): string {
  if (total <= 0) return '#e9c58d'
  const r = used / total
  if (r >= 1) return '#f3b1b1'
  if (r >= 0.8) return '#f5d7a0'
  if (r > 0) return '#b9e3a6'
  return '#e9c58d'
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

/* ================= LAYOUT THEO TỪNG KHO ================= */
interface MapCell {
  node: PhysicalWarehouseTreeNodeT
  leaves: Array<PhysicalWarehouseTreeNodeT>
  x: number
  y: number
}
interface MapRow {
  node: PhysicalWarehouseTreeNodeT
  zoneId: string | null
  x: number
  colH: number
  cells: Array<MapCell>
}
interface MapZone {
  node: PhysicalWarehouseTreeNodeT
  x: number
  y: number
  w: number
  h: number
}

/**
 * ✅ Ngữ nghĩa đúng:
 * - node truyền vào là WAREHOUSE (kho) → tiêu đề bản đồ = tên kho
 * - depth >= 4 (Khu → Dãy → Giá → Tầng) → con của kho là KHU (dashed)
 * - depth <= 3 (Dãy → Giá → Tầng ...) → không có khu, dãy hiện thẳng
 */
function buildWarehouseLayout(warehouse: PhysicalWarehouseTreeNodeT) {
  const depth = subtreeDepth(warehouse)
  const hasKhu =
    depth >= 4 &&
    warehouse.children.length > 0 &&
    !warehouse.children.some(isStorageUnitNode)

  const zoneY = TOP + TITLE_H
  const rackY0 = zoneY + (hasKhu ? ZONE_NAME_H : 8)

  const rows: Array<MapRow> = []
  const zoneRects: Array<MapZone> = []
  let x = LEFT
  let maxColH = 0

  const pushRow = (
    rowNode: PhysicalWarehouseTreeNodeT,
    zoneId: string | null,
  ) => {
    const cellNodes = rowNode.children
    const n = Math.max(1, cellNodes.length)
    const colH = n * BAY_H
    rows.push({
      node: rowNode,
      zoneId,
      x,
      colH,
      cells: cellNodes.map((c, ci) => ({
        node: c,
        leaves: collectLeaves(c),
        x,
        y: rackY0 + ci * BAY_H,
      })),
    })
    maxColH = Math.max(maxColH, colH)
    x += ROW_W + AISLE
    return colH
  }

  if (warehouse.children.every(isStorageUnitNode)) {
    // kho phẳng: 1 dãy duy nhất chứa các box
    rows.push({
      node: { ...warehouse, name: '' },
      zoneId: null,
      x,
      colH: Math.max(1, warehouse.children.length) * BAY_H,
      cells: warehouse.children.map((c, ci) => ({
        node: c,
        leaves: [c],
        x,
        y: rackY0 + ci * BAY_H,
      })),
    })
    maxColH = rows[0].colH
    x += ROW_W + AISLE
  } else if (hasKhu) {
    warehouse.children.forEach((zone) => {
      const zx0 = x
      let zMax = 0
      zone.children.forEach((rowNode) => {
        zMax = Math.max(zMax, pushRow(rowNode, zone.id))
      })
      zoneRects.push({
        node: zone,
        x: zx0 - 10,
        y: zoneY,
        w: Math.max(x - AISLE - zx0, ROW_W) + 20,
        h: rackY0 - zoneY + zMax + ROW_LABEL_H,
      })
    })
  } else {
    warehouse.children.forEach((rowNode) => pushRow(rowNode, null))
  }

  return {
    hasKhu,
    zoneRects,
    rows,
    rackY0,
    W: x - AISLE + LEFT,
    H: rackY0 + maxColH + ROW_LABEL_H + 10,
  }
}

function rowElevation(row: MapRow) {
  const cols = row.cells.length
  const k = Math.max(1, ...row.cells.map((c) => c.leaves.length))
  const m = Math.max(1, cols)
  const gridW = m * E_COL_W + (m + 1) * E_UP_W
  return {
    cols,
    k,
    gridW,
    floorY: E_TOP + k * E_LEVEL_H,
    W: E_LEFT + gridW + E_RIGHT,
    H: E_TOP + k * E_LEVEL_H + E_BOTTOM,
  }
}

/* ================= CANVAS CHO 1 KHO ================= */
function WarehouseMapCanvas({
  warehouse,
  height,
}: {
  warehouse: PhysicalWarehouseTreeNodeT
  height: number
}) {
  const { t } = useTranslation('physical-warehouse')
  const layout = useMemo(() => buildWarehouseLayout(warehouse), [warehouse])

  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ x: 0, y: 0, k: 0.5 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [scope, setScope] = useState<{
    zoneId: string | null
    rowId: string | null
  }>({ zoneId: null, rowId: null })
  const [hover, setHover] = useState<{
    text: string
    x: number
    y: number
  } | null>(null)

  const scopeZone = layout.zoneRects.find((z) => z.node.id === scope.zoneId)
  const scopeRow = layout.rows.find((r) => r.node.id === scope.rowId)

  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (!size.w) return
    let rect: { x: number; y: number; w: number; h: number }
    if (scope.rowId && scopeRow) {
      const b = rowElevation(scopeRow)
      rect = { x: 0, y: 0, w: b.W, h: b.H }
    } else if (scope.zoneId && scopeZone) {
      rect = scopeZone
    } else {
      rect = { x: 0, y: 0, w: layout.W, h: layout.H }
    }
    const k = Math.min(size.w / rect.w, size.h / rect.h) * 0.92
    const to = {
      k,
      x: size.w / 2 - (rect.x + rect.w / 2) * k,
      y: size.h / 2 - (rect.y + rect.h / 2) * k,
    }
    const from = { ...viewRef.current }
    const t0 = performance.now()
    const D = 500
    let raf: number
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / D)
      const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
      setView({
        k: from.k + (to.k - from.k) * e,
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
      })
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [scope, layout, size, scopeRow, scopeZone])

  const zoomAt = (px: number, py: number, f: number) =>
    setView((v) => {
      const k = Math.min(4, Math.max(0.1, v.k * f))
      const tt = k / v.k
      return { k, x: px - (px - v.x) * tt, y: py - (py - v.y) * tt }
    })

  const hoverAt = (text: string, e: any) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setHover({
      text,
      x: e.evt.clientX - box.left + 14,
      y: e.evt.clientY - box.top + 14,
    })
  }

  const setCursor = (e: any, val: string) => {
    e.target.getStage().container().style.cursor = val
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-md border bg-[#f4f4f4]"
      style={{ height }}
    >
      {size.w > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.k}
          scaleY={view.k}
          draggable
          onWheel={(e: any) => {
            const p = stageRef.current.getPointerPosition()
            zoomAt(p.x, p.y, e.evt.deltaY < 0 ? 1.1 : 1 / 1.1)
          }}
        >
          <Layer>
            {scopeRow ? (
              /* ========== MẶT CẮT DÃY ========== */
              <Group>
                {(() => {
                  const b = rowElevation(scopeRow)
                  return (
                    <>
                      <Rect
                        x={0}
                        y={0}
                        width={b.W}
                        height={b.H}
                        fill="#fafafa"
                        stroke="#222"
                        strokeWidth={2}
                        listening={false}
                      />
                      <Line
                        points={[10, b.floorY + 4, b.W - 10, b.floorY + 4]}
                        stroke="#444"
                        strokeWidth={2}
                        listening={false}
                      />
                      {Array.from({ length: b.k }, (_, idx) => (
                        <Rect
                          key={idx}
                          x={E_LEFT}
                          y={b.floorY - idx * E_LEVEL_H - E_BEAM_H}
                          width={b.gridW}
                          height={E_BEAM_H}
                          fill="#e8871e"
                          stroke="#b96a12"
                          listening={false}
                        />
                      ))}
                      {scopeRow.cells.map((cell, ci) => {
                        const colX = E_LEFT + ci * (E_COL_W + E_UP_W) + E_UP_W
                        return cell.leaves.map((leaf, li) => {
                          const palletY =
                            b.floorY -
                            li * E_LEVEL_H -
                            E_BEAM_H -
                            E_PALLET_H
                          const used = leaf.usedCapacity ?? 0
                          const total = leaf.capacity ?? 0
                          return (
                            <Group key={leaf.id}>
                              <Rect
                                x={colX + 4}
                                y={palletY}
                                width={E_COL_W - 8}
                                height={E_PALLET_H}
                                fill="#b08050"
                                listening={false}
                              />
                              <Rect
                                x={colX + 4}
                                y={palletY - E_BOX_H}
                                width={E_COL_W - 8}
                                height={E_BOX_H}
                                fill={usageFill(used, total)}
                                stroke="#c9a06a"
                                onMouseEnter={(e: any) => {
                                  setCursor(e, 'pointer')
                                  hoverAt(
                                    total > 0
                                      ? `${leaf.name} • ${t('manage.usedCapacity', { used, total })}`
                                      : leaf.name,
                                    e,
                                  )
                                }}
                                onMouseLeave={(e: any) => {
                                  setCursor(e, '')
                                  setHover(null)
                                }}
                              />
                            </Group>
                          )
                        })
                      })}
                      {Array.from({ length: b.cols + 1 }, (_, u) => {
                        const ux = E_LEFT + u * (E_COL_W + E_UP_W)
                        return (
                          <Group key={u} listening={false}>
                            <Rect
                              x={ux}
                              y={E_TOP - 4}
                              width={E_UP_W}
                              height={b.floorY - E_TOP + 6}
                              fill="#2b5ea7"
                            />
                            <Rect
                              x={ux - 3}
                              y={b.floorY + 2}
                              width={E_UP_W + 6}
                              height={4}
                              fill="#1d477e"
                            />
                          </Group>
                        )
                      })}
                      {scopeRow.cells.map((cell, ci) => (
                        <Text
                          key={cell.node.id}
                          x={E_LEFT + ci * (E_COL_W + E_UP_W) + E_UP_W}
                          y={b.floorY + 12}
                          width={E_COL_W}
                          align="center"
                          text={cell.node.name}
                          fontSize={11}
                          fontStyle="bold"
                          listening={false}
                        />
                      ))}
                      {Array.from({ length: b.k }, (_, idx) => (
                        <Text
                          key={idx}
                          x={E_LEFT + b.gridW + 12}
                          y={
                            b.floorY -
                            idx * E_LEVEL_H -
                            E_BEAM_H -
                            E_PALLET_H -
                            E_BOX_H +
                            8
                          }
                          text={`${t('manage.storageUnitLabel')} ${idx + 1}`}
                          fontSize={12}
                          listening={false}
                        />
                      ))}
                    </>
                  )
                })()}
              </Group>
            ) : (
              /* ========== BẢN ĐỒ KHO ========== */
              <Group>
                <Rect
                  x={0}
                  y={0}
                  width={layout.W}
                  height={layout.H}
                  fill={FLOOR}
                  stroke="#222"
                  strokeWidth={2}
                  listening={false}
                />
                {/* ✅ tiêu đề = tên KHO */}
                <Rect
                  x={6}
                  y={6}
                  width={warehouse.name.length * 10 + 16}
                  height={22}
                  fill={FLOOR}
                  listening={false}
                />
                <Text
                  x={10}
                  y={9}
                  text={warehouse.name}
                  fontSize={15}
                  fontStyle="bold"
                  fill="#333"
                  listening={false}
                />

                {layout.zoneRects.map((z) => (
                  <Group key={z.node.id}>
                    <Rect
                      x={z.x}
                      y={z.y}
                      width={z.w}
                      height={z.h}
                      fill={FLOOR}
                      stroke="#888"
                      dash={[6, 4]}
                      onMouseEnter={(e: any) => setCursor(e, 'pointer')}
                      onMouseLeave={(e: any) => setCursor(e, '')}
                      onClick={() => setScope({ zoneId: z.node.id, rowId: null })}
                    />
                    <Rect
                      x={z.x + 6}
                      y={z.y + 4}
                      width={Math.max(80, z.node.name.length * 9 + 12)}
                      height={20}
                      fill={FLOOR}
                      onClick={() => setScope({ zoneId: z.node.id, rowId: null })}
                      onMouseEnter={(e: any) => setCursor(e, 'pointer')}
                      onMouseLeave={(e: any) => setCursor(e, '')}
                    />
                    <Text
                      x={z.x + 6}
                      y={z.y + 7}
                      text={z.node.name}
                      fontSize={13}
                      fontStyle="bold"
                      fill="#444"
                      listening={false}
                    />
                  </Group>
                ))}

                {layout.rows.map((r) => {
                  const cellW = ROW_W - 2 * GAP
                  const n = Math.max(1, r.cells.length)
                  const beams = Array.from(
                    { length: n + 1 },
                    (_, i) => layout.rackY0 + i * BAY_H,
                  )
                  return (
                    <Group key={r.node.id}>
                      {r.cells.length === 0 ? (
                        <Rect
                          x={r.x + GAP}
                          y={layout.rackY0 + 2}
                          width={cellW}
                          height={BAY_H - 4}
                          stroke="#c9a06a"
                          dash={[4, 3]}
                          listening={false}
                        />
                      ) : (
                        r.cells.map((c) => {
                          const used = c.leaves.reduce(
                            (s, l) => s + (l.usedCapacity ?? 0),
                            0,
                          )
                          const total = c.leaves.reduce(
                            (s, l) => s + (l.capacity ?? 0),
                            0,
                          )
                          return (
                            <Rect
                              key={c.node.id}
                              x={c.x + GAP}
                              y={c.y + 2}
                              width={cellW}
                              height={BAY_H - 4}
                              fill={usageFill(used, total)}
                              stroke="#c9a06a"
                              strokeWidth={0.8}
                              cornerRadius={1}
                              onMouseEnter={(e: any) => {
                                setCursor(e, 'pointer')
                                hoverAt(`${r.node.name} • ${c.node.name}`, e)
                              }}
                              onMouseLeave={(e: any) => {
                                setCursor(e, '')
                                setHover(null)
                              }}
                              onClick={() =>
                                setScope({ zoneId: r.zoneId, rowId: r.node.id })
                              }
                            />
                          )
                        })
                      )}
                      <Group listening={false}>
                        <Line
                          points={[
                            r.x + 1,
                            layout.rackY0,
                            r.x + 1,
                            layout.rackY0 + r.colH,
                          ]}
                          stroke="#2b5ea7"
                          strokeWidth={2}
                        />
                        <Line
                          points={[
                            r.x + ROW_W - 1,
                            layout.rackY0,
                            r.x + ROW_W - 1,
                            layout.rackY0 + r.colH,
                          ]}
                          stroke="#2b5ea7"
                          strokeWidth={2}
                        />
                        {beams.map((by, i) => (
                          <Line
                            key={i}
                            points={[r.x, by, r.x + ROW_W, by]}
                            stroke="#e8871e"
                            strokeWidth={1.5}
                          />
                        ))}
                        {beams.map((by, i) => (
                          <Group key={'p' + i}>
                            <Rect
                              x={r.x - 1.5}
                              y={by - 2}
                              width={4}
                              height={4}
                              fill="#1d477e"
                            />
                            <Rect
                              x={r.x + ROW_W - 2.5}
                              y={by - 2}
                              width={4}
                              height={4}
                              fill="#1d477e"
                            />
                          </Group>
                        ))}
                      </Group>
                      {r.node.name ? (
                        <Text
                          x={r.x - 24}
                          y={layout.rackY0 + r.colH + 8}
                          width={ROW_W + 48}
                          align="center"
                          text={r.node.name}
                          fontSize={12}
                          fontStyle="bold"
                          onClick={() =>
                            setScope({ zoneId: r.zoneId, rowId: r.node.id })
                          }
                          onMouseEnter={(e: any) => setCursor(e, 'pointer')}
                          onMouseLeave={(e: any) => setCursor(e, '')}
                        />
                      ) : null}
                    </Group>
                  )
                })}
              </Group>
            )}
          </Layer>
        </Stage>
      )}

      {/* Breadcrumb: KHO / KHU / DÃY */}
      <div className="absolute left-2 top-2 rounded border border-border bg-background px-2.5 py-1.5 text-[13px] shadow-sm">
        <button
          type="button"
          className="font-bold hover:underline"
          onClick={() => setScope({ zoneId: null, rowId: null })}
        >
          {warehouse.name}
        </button>
        {scopeZone ? (
          <>
            {' / '}
            <button
              type="button"
              className="font-bold hover:underline"
              onClick={() => setScope({ zoneId: scope.zoneId, rowId: null })}
            >
              {scopeZone.node.name}
            </button>
          </>
        ) : null}
        {scopeRow ? <> / <b>{scopeRow.node.name}</b></> : null}
      </div>

      <div className="absolute right-2 top-2 flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 bg-background"
          onClick={() => zoomAt(size.w / 2, size.h / 2, 1.2)}
        >
          +
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 bg-background"
          onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.2)}
        >
          −
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 bg-background"
          title="PNG"
          onClick={() => {
            const a = document.createElement('a')
            a.href = stageRef.current.toDataURL({ pixelRatio: 2 })
            a.download = `${warehouse.name}.png`
            a.click()
          }}
        >
          ⤓
        </Button>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded border border-border bg-background px-2 py-1 text-xs shadow"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.text}
        </div>
      ) : null}
    </div>
  )
}

/* ================= TAB ================= */
interface WarehouseDiagramTabProps {
  rootId: string
  warehouseId?: string
  stats?: PhysicalWarehouseStatsT | null
  compact?: boolean
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
            <span className="font-semibold tabular-nums">
              {levelStat.count}
            </span>
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
            <span className="text-muted-foreground">
              {t('stats.fillRate')}
            </span>
            <span className="font-semibold tabular-nums">
              {stats.fillRate}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {t('stats.overloaded')}
            </span>
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
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')

  const { data: tree, isPending } = useQuery(
    physicalWarehouseTreeQueryOptions(rootId),
  )

  const filteredWarehouses = useMemo(() => {
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
        <Button type="submit" variant="secondary" size="sm">
          <Search className="size-3.5" />
          <span className="sr-only">{t('diagram.search')}</span>
        </Button>
      </form>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-3 overflow-hidden',
          stats && !compact
            ? 'lg:grid-cols-[minmax(0,1fr)_200px]'
            : undefined,
        )}
      >
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {filteredWarehouses.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              {t('diagram.noSearchResult')}
            </Card>
          ) : (
            filteredWarehouses.map((warehouse) => (
              <WarehouseMapCanvas
                key={warehouse.id}
                warehouse={warehouse}
                height={compact ? 380 : 520}
              />
            ))
          )}
        </div>

        {stats && !compact ? <OverviewSidebar stats={stats} /> : null}
      </div>
    </div>
  )
}