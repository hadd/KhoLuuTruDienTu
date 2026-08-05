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
const GAP = 3
const AISLE = 2.0 * M
const LEFT = 24
const TOP = 12
const TITLE_H = 26
const ZONE_NAME_H = 26
const ROW_LABEL_H = 26
const FLOOR = '#d8d8d8'

/* ✅ HỘP: KÍCH THƯỚC CỐ ĐỊNH */
const BOX_W = 18
const BOX_TOP_H = 7
const SLOT_GAP = 3
const SLOT_CAP = 3
const PAD_X = 4
const PAD_T = 2
const GAP_T = 2
const SHELF_GAP = 3
const CELL_PAD = 2

const colWOf = (cap: number) => 2 * PAD_X + cap * BOX_W + (cap - 1) * SLOT_GAP
const bayHOf = (cap: number) => 2 * PAD_T + cap * BOX_TOP_H + (cap - 1) * GAP_T

const E_UP_W = 6
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
  isBottomLevel: boolean
}): boolean {
  return node.parentId != null && node.isBottomLevel
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

function childSlots(node: PhysicalWarehouseTreeNodeT): number {
  return Math.max(node.children.length, node.capacity ?? 0, 1)
}

/** Số ô hộp trên một kệ: kệ.capacity → kệ nhiều hộp nhất của giá → mặc định 3 */
function giaSlotCap(gia: PhysicalWarehouseTreeNodeT): number {
  let m = 0
  for (const child of gia.children) {
    if (isStorageUnitNode(child)) m = Math.max(m, 1)
    else m = Math.max(m, child.capacity ?? collectLeaves(child).length)
  }
  return Math.max(1, m > 0 ? m : SLOT_CAP)
}

function cellUsage(
  node: PhysicalWarehouseTreeNodeT,
  leaves: Array<PhysicalWarehouseTreeNodeT>,
): { used: number; total: number } {
  if (isStorageUnitNode(node)) {
    return { used: node.usedCapacity ?? 0, total: node.capacity ?? 0 }
  }
  if (node.capacity != null) {
    return { used: node.children.length, total: node.capacity }
  }
  return {
    used: leaves.reduce((s, l) => s + (l.usedCapacity ?? 0), 0),
    total: leaves.reduce((s, l) => s + (l.capacity ?? 0), 0),
  }
}

/** ✅ Màu xanh đậm hơn cho hộp gỗ/nhãn tài liệu */
function usageFill(used: number, total: number): string {
  if (total <= 0) return '#74b655' // Xanh lá đậm mặc định khi không có hồ sơ
  const r = used / total
  if (r >= 1) return '#ff0000ff'
  if (r >= 0.5) return '#ffa600ff'
  if (r > 0) return '#51ff00ff' // Xanh lá đậm khi đã chứa
  return '#74b655' // Xanh lá đậm mặc định khi chưa chứa
}

/** ✅ Heatmap: nội suy Xanh nhạt → Vàng → Đỏ theo độ đầy của kệ */
function heatColor(used: number, total: number): string {
  if (total <= 0) return '#b9e3a6' // Mặc định là màu xanh nhạt heatmap khi không có hồ sơ
  const r = Math.min(1, Math.max(0, used / total))
  const G = [185, 227, 166] // #b9e3a6 (Xanh nhạt heatmap)
  const Y = [245, 215, 160]
  const R = [243, 177, 177]
  const [c1, c2, t] = r < 0.5 ? [G, Y, r * 2] : [Y, R, (r - 0.5) * 2]
  const rgb = c1.map((v, i) => Math.round(v + (c2[i] - v) * t))
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
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

/* ================= LAYOUT ================= */
interface MapShelf {
  node: PhysicalWarehouseTreeNodeT | null
  boxes: number
  cap: number
  y: number
  leafNodes: Array<PhysicalWarehouseTreeNodeT> // ✅ các hộp thật để tô màu từng strip
}
interface MapCell {
  node: PhysicalWarehouseTreeNodeT | null
  leaves: Array<PhysicalWarehouseTreeNodeT>
  shelves: Array<MapShelf>
  cap: number
  tierCount: number // ✅ số tầng của giá
  x: number
  y: number
  h: number
}
interface MapRow {
  node: PhysicalWarehouseTreeNodeT
  zoneId: string | null
  x: number
  colH: number
  slots: number
  cells: Array<MapCell>
  rowCap: number
  single: boolean
}
interface MapZone {
  node: PhysicalWarehouseTreeNodeT
  x: number
  y: number
  w: number
  h: number
}

/** Top-down: mỗi ô giá chỉ hiện TẦNG TRÊN NHẤT */
function buildShelves(
  node: PhysicalWarehouseTreeNodeT | null,
  cap: number,
): Array<MapShelf> {
  if (!node) return []
  if (isStorageUnitNode(node)) {
    const ucap = Math.max(1, node.capacity ?? 1)
    return [
      {
        node: null,
        boxes: Math.min(ucap, node.usedCapacity ?? 0),
        cap: ucap,
        y: 0,
        leafNodes: [node],
      },
    ]
  }
  const top = node.children[node.children.length - 1] ?? null
  if (!top) return [{ node: null, boxes: 0, cap, y: 0, leafNodes: [] }]
  const leafNodes = isStorageUnitNode(top)
    ? [top]
    : collectLeaves(top).slice(0, cap)
  return [
    {
      node: top,
      boxes: Math.min(cap, leafNodes.length),
      cap,
      y: 0,
      leafNodes,
    },
  ]
}

function assignShelfY(shelves: Array<MapShelf>, startY: number): number {
  let sy = startY
  for (const sh of shelves) {
    sh.y = sy
    sy += bayHOf(sh.cap) + SHELF_GAP
  }
  return sy - SHELF_GAP
}

function tierCountOf(node: PhysicalWarehouseTreeNodeT): number {
  return isStorageUnitNode(node) ? 1 : node.children.length
}

function buildWarehouseLayout(warehouse: PhysicalWarehouseTreeNodeT) {
  const depth = subtreeDepth(warehouse)
  const childrenAreUnits =
    warehouse.children.length > 0 &&
    warehouse.children.every(isStorageUnitNode)
  const hasKhu =
    depth >= 4 &&
    warehouse.children.length > 0 &&
    !warehouse.children.some(isStorageUnitNode)
  const shelfLikeGrand =
    warehouse.children.length > 0 &&
    warehouse.children.every((child) =>
      child.children.every(
        (g) =>
          isStorageUnitNode(g) ||
          g.children.length === 0 ||
          g.children.every(isStorageUnitNode),
      ),
    )
  const noDay = !childrenAreUnits && !hasKhu && depth >= 3 && shelfLikeGrand

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
    const slots = childSlots(rowNode)
    const rowCap = Math.max(
      SLOT_CAP,
      ...rowNode.children.map((g) =>
        isStorageUnitNode(g) ? 1 : giaSlotCap(g),
      ),
    )
    let by = rackY0
    const cells: Array<MapCell> = Array.from({ length: slots }, (_, i) => {
      const node = rowNode.children[i] ?? null
      const shelves = buildShelves(node, rowCap)
      const contentBottom = assignShelfY(shelves, by + CELL_PAD)
      const h =
        node == null || shelves.length === 0
          ? bayHOf(rowCap) + 2 * CELL_PAD
          : contentBottom - by + CELL_PAD
      const cell: MapCell = {
        node,
        leaves: node ? collectLeaves(node) : [],
        shelves,
        cap: rowCap,
        tierCount: node ? tierCountOf(node) : 0,
        x,
        y: by,
        h,
      }
      by += h // ✅ Đã loại bỏ khoảng trống dọc
      return cell
    })
    const colH = Math.max(0, by - rackY0) // ✅ Đã loại bỏ khoảng trống dọc
    rows.push({
      node: rowNode,
      zoneId,
      x,
      colH,
      slots,
      cells,
      rowCap,
      single: false,
    })
    maxColH = Math.max(maxColH, colH)
    x += ROW_W + AISLE
    return colH
  }

  const pushGiaColumn = (gia: PhysicalWarehouseTreeNodeT) => {
    const rowCap = Math.max(SLOT_CAP, giaSlotCap(gia))
    const shelves = buildShelves(gia, rowCap)
    const contentBottom = assignShelfY(shelves, rackY0 + CELL_PAD)
    const h =
      shelves.length === 0
        ? bayHOf(rowCap) + 2 * CELL_PAD
        : contentBottom - rackY0 + CELL_PAD
    rows.push({
      node: gia,
      zoneId: null,
      x,
      colH: h,
      slots: 1,
      cells: [
        {
          node: gia,
          leaves: collectLeaves(gia),
          shelves,
          cap: rowCap,
          tierCount: tierCountOf(gia),
          x,
          y: rackY0,
          h,
        },
      ],
      rowCap,
      single: true,
    })
    maxColH = Math.max(maxColH, h)
    x += ROW_W + AISLE
  }

  if (childrenAreUnits) {
    pushRow({ ...warehouse, name: '' }, null)
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
        w: Math.max(x - AISLE - zx0, ROW_W, zone.name.length * 9 + 24) + 20,
        h: rackY0 - zoneY + zMax + ROW_LABEL_H,
      })
    })
  } else if (noDay) {
    warehouse.children.forEach((gia) => pushGiaColumn(gia))
  } else {
    warehouse.children.forEach((rowNode) => pushRow(rowNode, null))
  }

  const zoneRight = zoneRects.reduce((m, z) => Math.max(m, z.x + z.w), 0)
  return {
    hasKhu,
    zoneRects,
    rows,
    rackY0,
    W: Math.max(x - AISLE + LEFT, zoneRight + 10),
    H: rackY0 + maxColH + ROW_LABEL_H + 10,
  }
}

/* ================= MẶT CẮT DÃY ================= */
interface ElevTier {
  node: PhysicalWarehouseTreeNodeT
  leaves: Array<PhysicalWarehouseTreeNodeT>
  /** ✅ true = tầng tự thân (node lá chưa có kệ): chỉ để vẽ ô trống, không lấy tên làm nhãn trục */
  self: boolean
}
interface ElevCol {
  node: PhysicalWarehouseTreeNodeT | null
  tiers: Array<ElevTier>
  levels: number
  x: number
  w: number
}

function elevationTiers(node: PhysicalWarehouseTreeNodeT): Array<ElevTier> {
  if (isStorageUnitNode(node)) return [{ node, leaves: [node], self: false }]
  // ✅ node lá (giá 1 tầng chưa có kệ): coi chính nó là 1 tầng để vẽ ô trống nét đứt
  if (node.children.length === 0)
    return [{ node, leaves: [], self: true }]
  return node.children.map((child) => ({
    node: child,
    leaves: collectLeaves(child),
    self: false,
  }))
}

function elevationModel(row: MapRow) {
  const colNodes: Array<PhysicalWarehouseTreeNodeT | null> = row.single
    ? [row.node]
    : row.cells.map((c) => c.node)
  const colSlots = Math.max(
    colNodes.length,
    row.single ? 1 : row.node.capacity ?? 0,
    1,
  )
  const cap = row.rowCap
  const colW = colWOf(cap)
  let cx = E_LEFT + E_UP_W
  const cols: Array<ElevCol> = Array.from({ length: colSlots }, (_, i) => {
    const node = colNodes[i] ?? null
    const tiers = node ? elevationTiers(node) : []
    const isUnit = Boolean(node && isStorageUnitNode(node))
    const levels =
      node && !isUnit
        ? Math.max(tiers.length, node.capacity ?? 0, 1)
        : Math.max(tiers.length, 1)
    const c: ElevCol = { node, tiers, levels, x: cx, w: colW }
    cx += colW + E_UP_W
    return c
  })
  const k = Math.max(1, ...cols.map((c) => c.levels))
  const gridW = cx - E_UP_W - E_LEFT
  const levelNames = Array.from({ length: k }, (_, idx) => {
    for (const c of cols) {
      const tier = c.tiers[idx]
      if (tier && !tier.self) return tier.node.name
    }
    return `${idx + 1}`
  })
  return {
    cols,
    k,
    cap,
    gridW,
    levelNames,
    floorY: E_TOP + k * E_LEVEL_H,
    W: E_LEFT + gridW + E_RIGHT,
    H: E_TOP + k * E_LEVEL_H + E_BOTTOM,
  }
}

/* ================= CANVAS 1 KHO ================= */
function WarehouseMapCanvas({
  warehouse,
  height,
  fill = false,
}: {
  warehouse: PhysicalWarehouseTreeNodeT
  height: number
  fill?: boolean
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
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (!size.w) return
    let rect: { x: number; y: number; w: number; h: number }
    if (scope.rowId && scopeRow) {
      const b = elevationModel(scopeRow)
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
      className={cn(
        'relative w-full overflow-hidden rounded-md border bg-[#f4f4f4]',
        fill ? 'min-h-[380px] flex-1' : undefined,
      )}
      style={fill ? undefined : { height }}
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
            {scopeRow ? { /* MẶT CẮT DÃY giữ nguyên */ } && (
              /* ========== MẶT CẮT DÃY ========== */
              <Group>
                {(() => {
                  const b = elevationModel(scopeRow)
                  const ups = [E_LEFT, ...b.cols.map((c) => c.x + c.w)]
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
                      {b.cols.map((col) => {
                        if (!col.node) return null
                        return col.tiers.map((tier, li) => {
                          const palletY =
                            b.floorY - li * E_LEVEL_H - E_BEAM_H - E_PALLET_H
                          const isUnit = isStorageUnitNode(tier.node)
                          const n = isUnit
                            ? 1
                            : Math.min(b.cap, tier.leaves.length)
                          const empties = isUnit ? 0 : b.cap - n
                          return (
                            <Group key={tier.node.id + (tier.self ? '-s' : '')}>
                              {Array.from({ length: n }, (_, bi) => {
                                const leaf = isUnit
                                  ? tier.node
                                  : tier.leaves[bi]
                                const sx = isUnit
                                  ? col.x + PAD_X
                                  : col.x + PAD_X + bi * (BOX_W + SLOT_GAP)
                                const sw = isUnit ? col.w - 2 * PAD_X : BOX_W
                                const used = leaf.usedCapacity ?? 0
                                const total = leaf.capacity ?? 0
                                const label = isUnit
                                  ? `${col.node!.name} • ${tier.node.name}`
                                  : `${col.node!.name} • ${tier.node.name} • ${leaf.name}`
                                return (
                                  <Group key={leaf.id}>
                                    <Rect
                                      x={sx}
                                      y={palletY}
                                      width={sw}
                                      height={E_PALLET_H}
                                      fill="#b08050"
                                      listening={false}
                                    />
                                    <Rect
                                      x={sx}
                                      y={palletY - E_BOX_H}
                                      width={sw}
                                      height={E_BOX_H}
                                      fill={usageFill(used, total)}
                                      stroke="#c9a06a"
                                      onMouseEnter={(e: any) => {
                                        setCursor(e, 'pointer')
                                        hoverAt(
                                          total > 0
                                            ? `${label} • ${t('manage.usedCapacity', { used, total })}`
                                            : label,
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
                              })}
                              {Array.from({ length: empties }, (_, ei) => (
                                <Rect
                                  key={'e' + ei}
                                  x={
                                    col.x +
                                    PAD_X +
                                    (n + ei) * (BOX_W + SLOT_GAP)
                                  }
                                  y={palletY - E_BOX_H}
                                  width={BOX_W}
                                  height={E_BOX_H}
                                  fill="rgba(255,255,255,0.5)"
                                  stroke="#bbb"
                                  strokeWidth={1}
                                  dash={[4, 3]}
                                  onMouseEnter={(e: any) => {
                                    setCursor(e, 'pointer')
                                    hoverAt(
                                      tier.self
                                        ? `${col.node!.name} • ô trống`
                                        : `${col.node!.name} • ${tier.node.name} • ô trống`,
                                      e,
                                    )
                                  }}
                                  onMouseLeave={(e: any) => {
                                    setCursor(e, '')
                                    setHover(null)
                                  }}
                                />
                              ))}
                            </Group>
                          )
                        })
                      })}
                      {ups.map((ux, u) => (
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
                      ))}
                      {b.cols.map((col, ci) => (
                        <Text
                          key={ci}
                          x={col.x}
                          y={b.floorY + 12}
                          width={col.w}
                          align="center"
                          text={col.node?.name ?? '—'}
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
                          text={b.levelNames[idx]}
                          fontSize={12}
                          listening={false}
                        />
                      ))}
                    </>
                  )
                })()}
              </Group>
            ) : (
              /* ========== BẢN ĐỒ KHO (TOP-DOWN + HEATMAP) ========== */
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
                <Rect
                  x={6}
                  y={6}
                  width={Math.min(
                    warehouse.name.length * 10 + 16,
                    layout.W - 12,
                  )}
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
                      width={Math.min(
                        Math.max(80, z.node.name.length * 9 + 12),
                        z.w - 12,
                      )}
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
                  const beams = [
                    layout.rackY0,
                    ...r.cells.map((c) => c.y + c.h),
                  ]
                  return (
                    <Group key={r.node.id}>
                      {r.cells.map((c, ci) => {
                        if (c.node == null) {
                          return (
                            <Rect
                              key={'e' + ci}
                              x={c.x + GAP}
                              y={c.y + 1}
                              width={cellW}
                              height={c.h - 2}
                              stroke="#c9a06a"
                              dash={[4, 3]}
                              listening={false}
                            />
                          )
                        }
                        const u = cellUsage(c.node, c.leaves)
                        const isUnitCell = isStorageUnitNode(c.node)
                        return (
                          <Group key={c.node.id}>
                            <Rect
                              x={c.x + GAP}
                              y={c.y + 1}
                              width={cellW}
                              height={c.h - 2}
                              fill={heatColor(u.used, u.total)} // ✅ Luôn hiện màu heatmap kể cả giá 1 tầng hoặc không có hồ sơ
                              stroke="#c9a06a"
                              strokeWidth={0.8}
                              cornerRadius={1}
                              onMouseEnter={(e: any) => {
                                setCursor(e, 'pointer')
                                hoverAt(
                                  u.total > 0
                                    ? `${r.node.name} • ${c.node!.name} • ${u.used}/${u.total}`
                                    : `${r.node.name} • ${c.node!.name}`,
                                  e,
                                )
                              }}
                              onMouseLeave={(e: any) => {
                                setCursor(e, '')
                                setHover(null)
                              }}
                              onClick={() =>
                                setScope({ zoneId: r.zoneId, rowId: r.node.id })
                              }
                            />
                            <Group listening={false}>
                              {c.shelves.map((sh, si) => {
                                const singleTier = c.tierCount === 1 && !isUnitCell
                                return (
                                  <Group key={si}>
                                    {Array.from({ length: sh.boxes }, (_, bi) => {
                                      const leaf = sh.leafNodes[bi]
                                      const stripFill = leaf
                                        ? usageFill(
                                          leaf.usedCapacity ?? 0,
                                          leaf.capacity ?? 0,
                                        )
                                        : '#74b655' // ✅ Chuyển đổi các hộp không có hồ sơ sang màu xanh lục đậm hơn
                                      return (
                                        <Rect
                                          key={'b' + bi}
                                          x={c.x + GAP + 3}
                                          y={
                                            sh.y +
                                            PAD_T +
                                            bi * (BOX_TOP_H + GAP_T)
                                          }
                                          width={cellW - 6}
                                          height={BOX_TOP_H}
                                          fill={stripFill}
                                          stroke="#b98d55"
                                          strokeWidth={0.6}
                                          cornerRadius={0.5}
                                        />
                                      )
                                    })}
                                    {Array.from(
                                      { length: Math.max(0, sh.cap - sh.boxes) },
                                      (_, ei) => (
                                        <Rect
                                          key={'d' + ei}
                                          x={c.x + GAP + 3}
                                          y={
                                            sh.y +
                                            PAD_T +
                                            (sh.boxes + ei) * (BOX_TOP_H + GAP_T)
                                          }
                                          width={cellW - 6}
                                          height={BOX_TOP_H}
                                          fill="rgba(255,255,255,0.45)"
                                          stroke="#b98d55"
                                          strokeWidth={0.6}
                                          dash={[3, 2]}
                                        />
                                      ),
                                    )}
                                  </Group>
                                )
                              })}
                            </Group>
                          </Group>
                        )
                      })}
                      <Group listening={false}>
                        <Line
                          points={[r.x + 1, layout.rackY0, r.x + 1, layout.rackY0 + r.colH]}
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
                            <Rect x={r.x - 1.5} y={by - 2} width={4} height={4} fill="#1d477e" />
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
      {/* Breadcrumb */}
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
        {scopeRow && scopeRow.node.name ? (
          <>
            {' / '}
            <b>{scopeRow.node.name}</b>
          </>
        ) : null}
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
            <span className="text-muted-foreground">{t('stats.fillRate')}</span>
            <span className="font-semibold tabular-nums">{stats.fillRate}%</span>
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
      className={cn('flex min-h-0 flex-1 flex-col', compact ? 'gap-2' : 'gap-3')}
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
          !compact ? 'min-h-[calc(100vh-230px)]' : undefined,
        )}
      >
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
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
                fill={!compact}
              />
            ))
          )}
        </div>
        {stats && !compact ? <OverviewSidebar stats={stats} /> : null}
      </div>
    </div>
  )
}