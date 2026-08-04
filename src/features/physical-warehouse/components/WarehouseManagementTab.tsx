import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  ChevronRight,
  Inbox,
  Layers,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getPlacementsByPhysicalItem,
  removeWarehouseDossierPlacement,
  reparentPhysicalWarehouseItem,
} from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type { ItemFormMode } from '@/features/physical-warehouse/components/ItemFormDialog'
import { ItemFormDialog } from '@/features/physical-warehouse/components/ItemFormDialog'
import { MoveDossierDialog } from '@/features/physical-warehouse/components/MoveDossierDialog'
import { PlaceUnplacedDossiersDialog } from '@/features/physical-warehouse/components/PlaceUnplacedDossiersDialog'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseQueryKeyPrefix,
  physicalWarehouseTreeQueryOptions,
} from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseItemT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

interface WarehouseManagementTabProps {
  rootId: string
  selectedParentId?: string
  onSelectParent: (parentId: string) => void
}

function isStorageUnit(item: {
  parentId: string | null
  isBottomLevel: boolean
}): boolean {
  // isBottomLevel is the single source of truth for "ô chứa" (storage unit).
  // capacity is no longer usable to detect this — it now also caps the number
  // of direct children for non-bottom-level nodes.
  return item.parentId != null && item.isBottomLevel
}

function hasIntermediateChild(
  node: Pick<PhysicalWarehouseTreeNodeT, 'children'>,
): boolean {
  return node.children.some((child) => !isStorageUnit(child))
}

function canAddStorageUnitToNode(
  node: PhysicalWarehouseTreeNodeT | null | undefined,
  listedChildren: Array<PhysicalWarehouseItemT> = [],
): boolean {
  if (!node || isStorageUnit(node)) return false
  if (hasIntermediateChild(node)) return false
  if (listedChildren.some((child) => !isStorageUnit(child))) return false
  return true
}

function findTreeNode(
  node: PhysicalWarehouseTreeNodeT,
  targetId: string,
): PhysicalWarehouseTreeNodeT | null {
  if (node.id === targetId) return node
  for (const child of node.children) {
    const found = findTreeNode(child, targetId)
    if (found) return found
  }
  return null
}

function getDirectStorageUnitChildren(
  targetParentId: string,
  tree: PhysicalWarehouseTreeNodeT | null | undefined,
  listedChildren: Array<PhysicalWarehouseItemT>,
  selectedParentId: string,
): Array<PhysicalWarehouseItemT> {
  if (tree) {
    const node = findTreeNode(tree, targetParentId)
    if (node) {
      return node.children.filter((child) => isStorageUnit(child))
    }
  }

  if (targetParentId === selectedParentId) {
    return listedChildren.filter((child) => isStorageUnit(child))
  }

  return []
}

function isIntermediateNode(
  item: { parentId: string | null; isBottomLevel: boolean },
  locationId: string,
): boolean {
  return (
    item.parentId != null &&
    item.parentId !== locationId &&
    !item.isBottomLevel
  )
}

function canDeleteIntermediateWithChildren(
  item: Pick<PhysicalWarehouseItemT, 'id' | 'parentId' | 'isBottomLevel' | 'childCount'>,
  childCount: number,
  locationId: string,
  tree: PhysicalWarehouseTreeNodeT | null | undefined,
  listedChildren: Array<PhysicalWarehouseItemT>,
  selectedParentId: string,
): boolean {
  if (!isIntermediateNode(item, locationId)) {
    return childCount === 0
  }
  if (childCount === 0) return true
  if (!item.parentId) return false

  const storageUnits = getDirectStorageUnitChildren(
    item.id,
    tree,
    listedChildren,
    selectedParentId,
  )
  return storageUnits.length === childCount
}

function canDeleteTreeNode(
  node: PhysicalWarehouseTreeNodeT,
  locationId: string,
): boolean {
  if (isStorageUnit(node)) return false
  if (node.parentId == null || node.parentId === locationId) {
    return node.childCount === 0
  }
  if (!isIntermediateNode(node, locationId)) {
    return node.childCount === 0
  }
  if (node.childCount === 0) return true
  return node.children.every((child) => isStorageUnit(child))
}

function flattenTree(
  node: PhysicalWarehouseTreeNodeT,
  acc: Array<PhysicalWarehouseTreeNodeT> = [],
): Array<PhysicalWarehouseTreeNodeT> {
  acc.push(node)
  for (const child of node.children) {
    flattenTree(child, acc)
  }
  return acc
}

function collectAncestorIds(
  nodes: Array<PhysicalWarehouseTreeNodeT>,
  targetId: string,
): Array<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ancestors: Array<string> = []
  let current = byId.get(targetId)
  while (current?.parentId) {
    ancestors.push(current.parentId)
    current = byId.get(current.parentId)
  }
  return ancestors
}

function TreeRows({
  node,
  locationId,
  selectedId,
  depth,
  expanded,
  canManageWarehouses,
  canManageWarehouseContents,
  onToggle,
  onSelect,
  onEdit,
  onAddIntermediate,
  onAddStorageUnit,
  onDelete,
  canAddStorageUnit,
  canDelete,
}: {
  node: PhysicalWarehouseTreeNodeT
  locationId: string
  selectedId?: string
  depth: number
  expanded: Set<string>
  canManageWarehouses: boolean
  canManageWarehouseContents: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onEdit: (item: PhysicalWarehouseTreeNodeT) => void
  onAddIntermediate: (parentId: string) => void
  onAddStorageUnit: (parentId: string) => void
  onDelete: (item: PhysicalWarehouseTreeNodeT) => void
  canAddStorageUnit: (node: PhysicalWarehouseTreeNodeT) => boolean
  canDelete: (node: PhysicalWarehouseTreeNodeT) => boolean
}) {
  const { t } = useTranslation('physical-warehouse')
  const isLocationRoot = node.parentId == null
  const isDirectWarehouse = node.parentId === locationId
  const isStorage = isStorageUnit(node)
  const canAddChildren = !isStorage
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const canEditDelete = isDirectWarehouse
    ? canManageWarehouses
    : !isLocationRoot && canManageWarehouseContents
  const canAddChildrenHere =
    canManageWarehouseContents && canAddChildren && !isLocationRoot
  const showInlineActions = canEditDelete && !isLocationRoot

  return (
    <>
      <div
        className={cn(
          'group flex w-full items-center gap-0.5 rounded px-1 py-0.5 text-sm hover:bg-muted',
          selectedId === node.id && 'bg-muted font-medium',
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            aria-expanded={isOpen}
            aria-label={isOpen ? t('manage.collapse') : t('manage.expand')}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
          >
            <ChevronRight
              className={cn(
                'size-3.5 text-muted-foreground transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </Button>
        ) : (
          <span className="inline-flex size-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left"
          onClick={() => onSelect(node.id)}
        >
          <span className="truncate">{node.name}</span>
        </button>
        {canAddChildrenHere ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                title={t('manage.addChildMenu')}
                onClick={(event) => event.stopPropagation()}
              >
                <Plus className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[11rem]">
              <DropdownMenuItem
                onClick={() => {
                  onSelect(node.id)
                  onAddIntermediate(node.id)
                }}
              >
                {t('manage.addIntermediate')}
              </DropdownMenuItem>
              {canAddStorageUnit(node) ? (
                <DropdownMenuItem
                  onClick={() => {
                    onSelect(node.id)
                    onAddStorageUnit(node.id)
                  }}
                >
                  {t('manage.addStorageUnit')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {showInlineActions ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            title={t('actions.edit')}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(node.id)
              onEdit(node)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
        {canEditDelete && canDelete(node) ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-destructive opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
            title={t('actions.delete')}
            onClick={(event) => {
              event.stopPropagation()
              onDelete(node)
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {hasChildren && isOpen
        ? node.children.map((child) => (
          <TreeRows
            key={child.id}
            node={child}
            locationId={locationId}
            selectedId={selectedId}
            depth={depth + 1}
            expanded={expanded}
            canManageWarehouses={canManageWarehouses}
            canManageWarehouseContents={canManageWarehouseContents}
            onToggle={onToggle}
            onSelect={onSelect}
            onEdit={onEdit}
            onAddIntermediate={onAddIntermediate}
            onAddStorageUnit={onAddStorageUnit}
            onDelete={onDelete}
            canAddStorageUnit={canAddStorageUnit}
            canDelete={canDelete}
          />
        ))
        : null}
    </>
  )
}

export function WarehouseManagementTab({
  rootId,
  selectedParentId,
  onSelectParent,
}: WarehouseManagementTabProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageWarehouses, canManageWarehouseContents } =
    usePhysicalWarehouseAccess()
  const queryClient = useQueryClient()
  const parentId = selectedParentId ?? rootId

  const { data: tree } = useQuery(physicalWarehouseTreeQueryOptions(rootId))
  const { data: children = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(parentId),
  )

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState<{
    dossierId: string
    dossierName: string
  } | null>(null)
  const [formItem, setFormItem] = useState<PhysicalWarehouseItemT | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]))
  const [intermediateConfirmOpen, setIntermediateConfirmOpen] = useState(false)
  const [pendingIntermediateParentId, setPendingIntermediateParentId] =
    useState<string | null>(null)
  const [pendingStorageUnitIds, setPendingStorageUnitIds] = useState<
    Array<string>
  >([])
  const [deleteMoveConfirmOpen, setDeleteMoveConfirmOpen] = useState(false)
  const [deleteMoveStorageUnitsUp, setDeleteMoveStorageUnitsUp] = useState<{
    storageUnitIds: Array<string>
    targetParentId: string
  } | null>(null)

  const flatNodes = useMemo(
    () => (tree ? flattenTree(tree) : []),
    [tree],
  )

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(rootId)
      return next
    })
  }, [rootId])

  useEffect(() => {
    if (flatNodes.length === 0) return
    const ancestors = collectAncestorIds(flatNodes, parentId)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(rootId)
      next.add(parentId)
      for (const id of ancestors) next.add(id)
      return next
    })
  }, [flatNodes, parentId, rootId])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedNode = useMemo(() => {
    return flatNodes.find((n) => n.id === parentId) ?? tree ?? null
  }, [flatNodes, parentId, tree])

  const isBottomSelected = Boolean(
    selectedNode && isStorageUnit(selectedNode),
  )
  const canAddChildren =
    Boolean(selectedNode) &&
    !isBottomSelected &&
    selectedNode != null
  const canAddStorageUnitAtSelected = canAddStorageUnitToNode(
    selectedNode,
    children,
  )

  const placementsQuery = useQuery({
    queryKey: ['physical-warehouse', 'placements-by-item', parentId],
    queryFn: () => getPlacementsByPhysicalItem(parentId),
    enabled: isBottomSelected && Boolean(parentId) && parentId !== rootId,
    staleTime: 15_000,
  })

  const usedInBox =
    placementsQuery.data?.reduce((sum, row) => sum + (row.units ?? 1), 0) ??
    selectedNode?.usedCapacity ??
    0
  // capacity only means "storage capacity" for a bottom-level (isBottomLevel) node;
  // for every other level it means "max direct children" and must not be used here.
  const capacityTotal = isBottomSelected ? (selectedNode?.capacity ?? null) : null
  const remainingCapacity =
    capacityTotal == null ? null : Math.max(0, capacityTotal - usedInBox)

  const removeMutation = useMutation({
    mutationFn: (dossierId: string) =>
      removeWarehouseDossierPlacement({ dossierId }),
    onSuccess: () => {
      toast.success(t('manage.removeSuccess'))
      void queryClient.invalidateQueries({
        queryKey: ['physical-warehouse'],
      })
    },
    onError: (error) => {
      toast.error(translateError(error) || String(error.message))
    },
  })

  const filteredChildren = children.filter((item) =>
    search.trim()
      ? item.name.toLowerCase().includes(search.trim().toLowerCase())
      : true,
  )

  const childCountById = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of flatNodes) {
      map.set(node.id, node.childCount)
    }
    for (const item of children) {
      if (item.childCount != null && !map.has(item.id)) {
        map.set(item.id, item.childCount)
      }
    }
    return map
  }, [flatNodes, children])

  function getChildCount(item: PhysicalWarehouseItemT): number {
    return childCountById.get(item.id) ?? item.childCount ?? 0
  }

  function beginCreateIntermediate(
    targetParentId: string,
    storageUnitIdsToMove: Array<string> = [],
  ) {
    onSelectParent(targetParentId)
    setFormItem(null)
    setMode({
      kind: 'intermediate',
      parentId: targetParentId,
      levelLabel: t('manage.intermediateLabel'),
      isBottomLevel: false,
      storageUnitIdsToMove,
    })
    setFormOpen(true)
  }

  function openCreateIntermediate(targetParentId: string = parentId) {
    const storageUnits = getDirectStorageUnitChildren(
      targetParentId,
      tree,
      children,
      parentId,
    )

    if (storageUnits.length > 0) {
      setPendingIntermediateParentId(targetParentId)
      setPendingStorageUnitIds(storageUnits.map((item) => item.id))
      setIntermediateConfirmOpen(true)
      return
    }

    beginCreateIntermediate(targetParentId)
  }

  function confirmCreateIntermediateWithMove() {
    if (!pendingIntermediateParentId) return
    const targetParentId = pendingIntermediateParentId
    const storageUnitIds = [...pendingStorageUnitIds]
    setIntermediateConfirmOpen(false)
    setPendingIntermediateParentId(null)
    setPendingStorageUnitIds([])
    beginCreateIntermediate(targetParentId, storageUnitIds)
  }

  function cancelIntermediateMoveChoice() {
    setIntermediateConfirmOpen(false)
    setPendingIntermediateParentId(null)
    setPendingStorageUnitIds([])
  }

  async function handleIntermediateCreated(record: PhysicalWarehouseItemT) {
    const idsToMove = mode?.storageUnitIdsToMove ?? []
    if (idsToMove.length === 0) return

    try {
      for (const storageUnitId of idsToMove) {
        await reparentPhysicalWarehouseItem(storageUnitId, record.id)
      }
      void queryClient.invalidateQueries({
        queryKey: physicalWarehouseQueryKeyPrefix,
      })
      toast.success(
        t('manage.moveStorageUnitsSuccess', { count: idsToMove.length }),
      )
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  function openCreateStorageUnit(targetParentId: string = parentId) {
    const node =
      flatNodes.find((item) => item.id === targetParentId) ?? selectedNode
    if (!canAddStorageUnitToNode(node, children)) return

    onSelectParent(targetParentId)
    setFormItem(null)
    setMode({
      kind: 'storageUnit',
      parentId: targetParentId,
      levelLabel: t('manage.storageUnitLabel'),
      isBottomLevel: true,
    })
    setFormOpen(true)
  }

  function openEdit(item: PhysicalWarehouseItemT) {
    setFormItem(item)
    if (isStorageUnit(item)) {
      setMode({
        kind: 'storageUnit',
        parentId: item.parentId,
        levelLabel: t('manage.storageUnitLabel'),
        isBottomLevel: true,
      })
    } else if (item.parentId == null) {
      setMode({
        kind: 'location',
        parentId: null,
        levelLabel: t('manage.locationLabel'),
        isBottomLevel: false,
      })
    } else if (item.parentId === rootId) {
      setMode({
        kind: 'warehouse',
        parentId: item.parentId,
        levelLabel: t('manage.warehouseLabel'),
        isBottomLevel: false,
      })
    } else {
      setMode({
        kind: 'intermediate',
        parentId: item.parentId,
        levelLabel: t('manage.intermediateLabel'),
        isBottomLevel: false,
      })
    }
    setFormOpen(true)
  }

  function openEditSelected() {
    if (!selectedNode || selectedNode.id === rootId) {
      return
    }
    openEdit(selectedNode)
  }

  function canDeleteItem(item: PhysicalWarehouseItemT): boolean {
    return canDeleteIntermediateWithChildren(
      item,
      getChildCount(item),
      rootId,
      tree,
      children,
      parentId,
    )
  }

  function openDelete(item: PhysicalWarehouseItemT) {
    if (!canDeleteItem(item)) return

    const childCount = getChildCount(item)
    if (childCount === 0) {
      setDeleteMoveStorageUnitsUp(null)
      setDeleteTarget(item)
      setDeleteOpen(true)
      return
    }

    const storageUnits = getDirectStorageUnitChildren(
      item.id,
      tree,
      children,
      parentId,
    )
    if (
      storageUnits.length === childCount &&
      isIntermediateNode(item, rootId) &&
      item.parentId
    ) {
      setDeleteTarget(item)
      setPendingStorageUnitIds(storageUnits.map((unit) => unit.id))
      setDeleteMoveConfirmOpen(true)
      return
    }
  }

  function cancelDeleteMoveChoice() {
    setDeleteMoveConfirmOpen(false)
    setDeleteTarget(null)
    setPendingStorageUnitIds([])
  }

  function confirmDeleteWithMove() {
    if (!deleteTarget?.parentId) {
      cancelDeleteMoveChoice()
      return
    }

    const storageUnitIds = [...pendingStorageUnitIds]
    setDeleteMoveConfirmOpen(false)
    setPendingStorageUnitIds([])

    setDeleteMoveStorageUnitsUp({
      storageUnitIds,
      targetParentId: deleteTarget.parentId,
    })
    setDeleteOpen(true)
  }

  function handleDeleted(item: PhysicalWarehouseItemT) {
    const deletedId = item.id
    const selectedIsUnderDeleted = (() => {
      let current = flatNodes.find((n) => n.id === parentId)
      while (current) {
        if (current.id === deletedId) return true
        current = flatNodes.find((n) => n.id === current?.parentId)
      }
      return false
    })()

    if (selectedIsUnderDeleted) {
      onSelectParent(item.parentId ?? rootId)
    }
    setDeleteTarget(null)
    setDeleteMoveStorageUnitsUp(null)
  }

  const isAtLocationLevel = parentId === rootId
  const canManageListedChildren = isAtLocationLevel
    ? canManageWarehouses
    : canManageWarehouseContents
  const canAddAtSelectedLevel = isAtLocationLevel
    ? canManageWarehouses
    : canManageWarehouseContents
  const canManageSelectedNode =
    selectedNode && selectedNode.id !== rootId
      ? selectedNode.parentId === rootId
        ? canManageWarehouses
        : canManageWarehouseContents
      : false

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="max-h-[70vh] overflow-auto p-3">
        <div className="mb-2 text-sm font-medium">{t('manage.treeTitle')}</div>
        {tree ? (
          <TreeRows
            node={tree}
            locationId={rootId}
            selectedId={parentId}
            depth={0}
            expanded={expanded}
            canManageWarehouses={canManageWarehouses}
            canManageWarehouseContents={canManageWarehouseContents}
            onToggle={toggleExpanded}
            onSelect={onSelectParent}
            onEdit={openEdit}
            onAddIntermediate={openCreateIntermediate}
            onAddStorageUnit={openCreateStorageUnit}
            onDelete={openDelete}
            canAddStorageUnit={(node) => canAddStorageUnitToNode(node)}
            canDelete={(node) => canDeleteTreeNode(node, rootId)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">...</p>
        )}
      </Card>

      <div className="space-y-3">
        {!isBottomSelected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('manage.searchPlaceholder')}
              />
              {canAddAtSelectedLevel && canAddChildren ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8"
                    title={t('manage.addIntermediate')}
                    aria-label={t('manage.addIntermediate')}
                    onClick={() => openCreateIntermediate()}
                  >
                    <Layers className="size-4" />
                  </Button>
                  {canManageWarehouseContents && canAddStorageUnitAtSelected ? (
                    <Button
                      type="button"
                      size="icon"
                      className="size-8"
                      title={t('manage.addStorageUnit')}
                      aria-label={t('manage.addStorageUnit')}
                      onClick={() => openCreateStorageUnit()}
                    >
                      <Package className="size-4" />
                    </Button>
                  ) : null}
                </>
              ) : null}
              {canManageSelectedNode &&
                selectedNode &&
                selectedNode.id !== rootId &&
                canDeleteItem(selectedNode) ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8 text-destructive hover:text-destructive"
                  title={t('manage.deleteSelected', { name: selectedNode.name })}
                  aria-label={t('actions.delete')}
                  onClick={() => openDelete(selectedNode)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <Card className="overflow-hidden" variant="list">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('manage.columns.name')}</TableHead>
                    <TableHead>{t('manage.columns.address')}</TableHead>
                    <TableHead>{t('manage.columns.capacity')}</TableHead>
                    <TableHead className="w-[100px]">
                      {t('manage.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    <TableRow>
                      <TableCell colSpan={4}>...</TableCell>
                    </TableRow>
                  ) : filteredChildren.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {t('manage.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChildren.map((item) => {
                      const canDeleteRow = canDeleteItem(item)
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() => onSelectParent(item.id)}
                            >
                              {item.name}
                            </button>
                          </TableCell>
                          <TableCell>{item.address ?? '—'}</TableCell>
                          <TableCell>
                            {item.isBottomLevel
                              ? item.capacity != null
                                ? t('manage.usedCapacity', {
                                  used: item.usedCapacity ?? 0,
                                  total: item.capacity,
                                })
                                : '—'
                              : item.capacity != null
                                ? t('manage.usedMaxChildren', {
                                  used: item.childCount ?? 0,
                                  total: item.capacity,
                                })
                                : '—'}
                          </TableCell>
                          <TableCell>
                            {canManageListedChildren ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  title={t('actions.edit')}
                                  aria-label={t('actions.edit')}
                                  onClick={() => openEdit(item)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 text-destructive hover:text-destructive"
                                  disabled={!canDeleteRow}
                                  title={
                                    canDeleteRow
                                      ? t('actions.delete')
                                      : t('delete.hasChildren')
                                  }
                                  aria-label={t('actions.delete')}
                                  onClick={() => openDelete(item)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-medium">
                  {selectedNode?.name}
                </h2>
                {capacityTotal != null ? (
                  <p className="text-xs text-muted-foreground">
                    {t('manage.usedCapacity', {
                      used: usedInBox,
                      total: capacityTotal,
                    })}
                  </p>
                ) : null}
              </div>
              {canManageWarehouseContents ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    className="size-8"
                    title={t('manage.placeUnplaced')}
                    aria-label={t('manage.placeUnplaced')}
                    disabled={(remainingCapacity ?? 0) <= 0}
                    onClick={() => setPlaceOpen(true)}
                  >
                    <Inbox className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8"
                    title={t('actions.edit')}
                    aria-label={t('actions.edit')}
                    onClick={openEditSelected}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8 text-destructive hover:text-destructive"
                    disabled={(placementsQuery.data?.length ?? 0) > 0}
                    title={
                      (placementsQuery.data?.length ?? 0) > 0
                        ? t('delete.hasPlacements')
                        : t('actions.delete')
                    }
                    aria-label={t('actions.delete')}
                    onClick={() =>
                      selectedNode ? openDelete(selectedNode) : undefined
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>

            <Card className="overflow-hidden" variant="list">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-medium">{t('manage.dossiersInBox')}</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('manage.dossierName')}</TableHead>
                    <TableHead>{t('manage.dossierPath')}</TableHead>
                    {canManageWarehouseContents ? (
                      <TableHead className="w-[100px]">
                        {t('manage.columns.actions')}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placementsQuery.isPending ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManageWarehouseContents ? 3 : 2}
                        className="text-muted-foreground"
                      >
                        …
                      </TableCell>
                    </TableRow>
                  ) : (placementsQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManageWarehouseContents ? 3 : 2}
                        className="text-muted-foreground"
                      >
                        {t('manage.dossiersEmpty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (placementsQuery.data ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.dossierName}
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-muted-foreground">
                          {row.folderPath ?? '—'}
                        </TableCell>
                        {canManageWarehouseContents ? (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                title={t('manage.moveToBox')}
                                aria-label={t('manage.moveToBox')}
                                onClick={() => {
                                  setMoveTarget({
                                    dossierId: row.dossierId,
                                    dossierName: row.dossierName,
                                  })
                                  setMoveOpen(true)
                                }}
                              >
                                <ArrowRightLeft className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive hover:text-destructive"
                                title={t('manage.removeFromBox')}
                                aria-label={t('manage.removeFromBox')}
                                disabled={removeMutation.isPending}
                                onClick={() =>
                                  removeMutation.mutate(row.dossierId)
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      {mode ? (
        <ItemFormDialog
          key={`${formItem?.id ?? 'new'}-${mode.kind}-${formOpen}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={mode}
          item={formItem}
          onCreated={
            mode.kind === 'intermediate' &&
              (mode.storageUnitIdsToMove?.length ?? 0) > 0
              ? handleIntermediateCreated
              : undefined
          }
        />
      ) : null}
      <Dialog
        open={intermediateConfirmOpen}
        onOpenChange={(open) => {
          if (!open) cancelIntermediateMoveChoice()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manage.moveStorageUnitsConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('manage.moveStorageUnitsConfirmDescription', {
                count: pendingStorageUnitIds.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelIntermediateMoveChoice}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button type="button" onClick={confirmCreateIntermediateWithMove}>
              {t('manage.moveStorageUnitsYes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteMoveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) cancelDeleteMoveChoice()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manage.moveStorageUnitsOnDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('manage.moveStorageUnitsOnDeleteDescription', {
                count: pendingStorageUnitIds.length,
                name: deleteTarget?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={cancelDeleteMoveChoice}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteWithMove}
            >
              {t('manage.moveStorageUnitsOnDeleteYes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ItemDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setDeleteMoveStorageUnitsUp(null)
          }
        }}
        item={deleteTarget}
        onDeleted={handleDeleted}
        moveStorageUnitsUp={deleteMoveStorageUnitsUp}
      />
      {isBottomSelected && selectedNode ? (
        <PlaceUnplacedDossiersDialog
          open={placeOpen}
          onOpenChange={setPlaceOpen}
          physicalItemId={selectedNode.id}
          boxName={selectedNode.name}
          remainingCapacity={remainingCapacity}
        />
      ) : null}
      {isBottomSelected && selectedNode && moveTarget ? (
        <MoveDossierDialog
          open={moveOpen}
          onOpenChange={(open) => {
            setMoveOpen(open)
            if (!open) setMoveTarget(null)
          }}
          dossierId={moveTarget.dossierId}
          dossierName={moveTarget.dossierName}
          currentPhysicalItemId={selectedNode.id}
        />
      ) : null}
    </div>
  )
}