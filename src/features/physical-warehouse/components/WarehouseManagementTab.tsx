import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
} from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type { ItemFormMode } from '@/features/physical-warehouse/components/ItemFormDialog'
import { ItemFormDialog } from '@/features/physical-warehouse/components/ItemFormDialog'
import { PlaceUnplacedDossiersDialog } from '@/features/physical-warehouse/components/PlaceUnplacedDossiersDialog'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseTreeQueryOptions,
} from '@/features/physical-warehouse/queries'
import type {
  PhysicalWarehouseItemT,
  PhysicalWarehouseLevelT,
  PhysicalWarehouseTreeNodeT,
} from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

interface WarehouseManagementTabProps {
  rootId: string
  levels: Array<PhysicalWarehouseLevelT>
  selectedParentId?: string
  onSelectParent: (parentId: string) => void
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
  levels,
  selectedId,
  depth,
  expanded,
  canDelete,
  onToggle,
  onSelect,
  onDelete,
}: {
  node: PhysicalWarehouseTreeNodeT
  levels: Array<PhysicalWarehouseLevelT>
  selectedId?: string
  depth: number
  expanded: Set<string>
  canDelete: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onDelete: (item: PhysicalWarehouseTreeNodeT) => void
}) {
  const { t } = useTranslation('physical-warehouse')
  const level = levels.find((l) => l.id === node.levelId)
  const label = level?.levelName ?? t('manage.locationLabel')
  const isLocationRoot = node.levelId == null && node.parentId == null
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)

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
          <span className="truncate">
            {node.name}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({label})
            </span>
          </span>
        </button>
        {canDelete && !isLocationRoot && node.childCount === 0 ? (
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
              levels={levels}
              selectedId={selectedId}
              depth={depth + 1}
              expanded={expanded}
              canDelete={canDelete}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  )
}

export function WarehouseManagementTab({
  rootId,
  levels,
  selectedParentId,
  onSelectParent,
}: WarehouseManagementTabProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageItems } = usePhysicalWarehouseAccess()
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
  const [formItem, setFormItem] = useState<PhysicalWarehouseItemT | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]))

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

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.levelOrder - b.levelOrder),
    [levels],
  )
  const selectedLevel = sortedLevels.find((l) => l.id === selectedNode?.levelId)
  const minOrder = sortedLevels[0]?.levelOrder ?? 1
  const maxOrder = sortedLevels[sortedLevels.length - 1]?.levelOrder ?? 1
  const isBottomSelected =
    Boolean(selectedNode?.capacity != null) ||
    (selectedLevel != null && selectedLevel.levelOrder === maxOrder)

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
  const capacityTotal = selectedNode?.capacity ?? null
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

  const nextLevel = useMemo(() => {
    if (!selectedNode) return null
    if (!selectedNode.levelId) {
      return sortedLevels.find((l) => l.levelOrder === minOrder) ?? null
    }
    if (!selectedLevel) return null
    return (
      sortedLevels.find((l) => l.levelOrder === selectedLevel.levelOrder + 1) ??
      null
    )
  }, [selectedNode, selectedLevel, sortedLevels, minOrder])

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

  function openCreateChild() {
    if (!nextLevel) return
    setFormItem(null)
    setMode({
      kind: 'level',
      isTopLevel: nextLevel.levelOrder === minOrder,
      isBottomLevel: nextLevel.levelOrder === maxOrder,
      levelId: nextLevel.id,
      parentId,
      levelLabel: nextLevel.levelName,
    })
    setFormOpen(true)
  }

  function openEdit(item: PhysicalWarehouseItemT) {
    const level = sortedLevels.find((l) => l.id === item.levelId)
    if (!level) return
    setFormItem(item)
    setMode({
      kind: 'level',
      isTopLevel: level.levelOrder === minOrder,
      isBottomLevel: level.levelOrder === maxOrder,
      levelId: level.id,
      parentId: item.parentId,
      levelLabel: level.levelName,
    })
    setFormOpen(true)
  }

  function openEditSelected() {
    if (!selectedNode || selectedNode.id === rootId || !selectedNode.levelId) {
      return
    }
    openEdit(selectedNode)
  }

  function openDelete(item: PhysicalWarehouseItemT) {
    if (getChildCount(item) > 0) return
    setDeleteTarget(item)
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
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="max-h-[70vh] overflow-auto p-3">
        <div className="mb-2 text-sm font-medium">{t('manage.treeTitle')}</div>
        {tree ? (
          <TreeRows
            node={tree}
            levels={levels}
            selectedId={parentId}
            depth={0}
            expanded={expanded}
            canDelete={canManageItems}
            onToggle={toggleExpanded}
            onSelect={onSelectParent}
            onDelete={openDelete}
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
              {canManageItems && nextLevel ? (
                <Button type="button" size="sm" onClick={openCreateChild}>
                  <Plus className="mr-1 size-4" />
                  {t('manage.addChild', { level: nextLevel.levelName })}
                </Button>
              ) : null}
              {canManageItems &&
              selectedNode &&
              selectedNode.id !== rootId &&
              selectedNode.levelId != null &&
              selectedNode.childCount === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => openDelete(selectedNode)}
                >
                  <Trash2 className="mr-1 size-4" />
                  {t('manage.deleteSelected', { name: selectedNode.name })}
                </Button>
              ) : null}
            </div>

            <Card className="overflow-hidden" variant="list">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('manage.columns.name')}</TableHead>
                    <TableHead>{t('manage.columns.level')}</TableHead>
                    <TableHead>{t('manage.columns.address')}</TableHead>
                    <TableHead>{t('manage.columns.capacity')}</TableHead>
                    <TableHead className="w-[140px]">
                      {t('manage.columns.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending ? (
                    <TableRow>
                      <TableCell colSpan={5}>...</TableCell>
                    </TableRow>
                  ) : filteredChildren.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t('manage.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChildren.map((item) => {
                      const level = sortedLevels.find((l) => l.id === item.levelId)
                      const canDeleteItem = getChildCount(item) === 0
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
                          <TableCell>
                            {level?.levelName ?? t('manage.locationLabel')}
                          </TableCell>
                          <TableCell>{item.address ?? '—'}</TableCell>
                          <TableCell>
                            {item.capacity != null
                              ? t('manage.usedCapacity', {
                                  used: item.usedCapacity ?? 0,
                                  total: item.capacity,
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {canManageItems ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEdit(item)}
                                >
                                  {t('actions.edit')}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={!canDeleteItem}
                                  title={
                                    canDeleteItem
                                      ? t('actions.delete')
                                      : t('delete.hasChildren')
                                  }
                                  onClick={() => openDelete(item)}
                                >
                                  {t('actions.delete')}
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
              {canManageItems ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPlaceOpen(true)}
                    disabled={(remainingCapacity ?? 0) <= 0}
                  >
                    <Plus className="mr-1 size-4" />
                    {t('manage.placeUnplaced')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openEditSelected}
                  >
                    <Pencil className="mr-1 size-4" />
                    {t('actions.edit')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={(placementsQuery.data?.length ?? 0) > 0}
                    title={
                      (placementsQuery.data?.length ?? 0) > 0
                        ? t('delete.hasPlacements')
                        : t('actions.delete')
                    }
                    onClick={() =>
                      selectedNode ? openDelete(selectedNode) : undefined
                    }
                  >
                    <Trash2 className="mr-1 size-4" />
                    {t('actions.delete')}
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
                    {canManageItems ? (
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
                        colSpan={canManageItems ? 3 : 2}
                        className="text-muted-foreground"
                      >
                        …
                      </TableCell>
                    </TableRow>
                  ) : (placementsQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManageItems ? 3 : 2}
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
                        {canManageItems ? (
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={removeMutation.isPending}
                              onClick={() =>
                                removeMutation.mutate(row.dossierId)
                              }
                            >
                              {t('manage.removeFromBox')}
                            </Button>
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
          key={`${formItem?.id ?? 'new'}-${formOpen}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={mode}
          item={formItem}
        />
      ) : null}
      <ItemDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        item={deleteTarget}
        onDeleted={handleDeleted}
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
    </div>
  )
}
