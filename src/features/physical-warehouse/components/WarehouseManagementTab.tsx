import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type {ItemFormMode} from '@/features/physical-warehouse/components/ItemFormDialog';
import {
  ItemFormDialog
} from '@/features/physical-warehouse/components/ItemFormDialog'
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

function TreeRows({
  node,
  levels,
  selectedId,
  depth,
  onSelect,
}: {
  node: PhysicalWarehouseTreeNodeT
  levels: Array<PhysicalWarehouseLevelT>
  selectedId?: string
  depth: number
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('physical-warehouse')
  const level = levels.find((l) => l.id === node.levelId)
  const label = level?.levelName ?? t('manage.locationLabel')

  return (
    <>
      <button
        type="button"
        className={`flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
          selectedId === node.id ? 'bg-muted font-medium' : ''
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => onSelect(node.id)}
      >
        <ChevronRight className="size-3 shrink-0 opacity-50" />
        <span className="truncate">
          {node.name}
          <span className="ml-1 text-xs text-muted-foreground">({label})</span>
        </span>
      </button>
      {node.children.map((child) => (
        <TreeRows
          key={child.id}
          node={child}
          levels={levels}
          selectedId={selectedId}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
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
  const parentId = selectedParentId ?? rootId

  const { data: tree } = useQuery(physicalWarehouseTreeQueryOptions(rootId))
  const { data: children = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(parentId),
  )

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode | null>(null)

  const selectedNode = useMemo(() => {
    if (!tree) return null
    return flattenTree(tree).find((n) => n.id === parentId) ?? tree
  }, [tree, parentId])

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.levelOrder - b.levelOrder),
    [levels],
  )
  const selectedLevel = sortedLevels.find((l) => l.id === selectedNode?.levelId)
  const minOrder = sortedLevels[0]?.levelOrder ?? 1
  const maxOrder = sortedLevels[sortedLevels.length - 1]?.levelOrder ?? 1

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

  function openCreateChild() {
    if (!nextLevel) return
    setSelected(null)
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
    setSelected(item)
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

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="max-h-[70vh] overflow-auto p-3">
        <div className="mb-2 text-sm font-medium">{t('manage.treeTitle')}</div>
        {tree ? (
          <TreeRows
            node={tree}
            levels={levels}
            selectedId={parentId}
            depth={0}
            onSelect={onSelectParent}
          />
        ) : (
          <p className="text-sm text-muted-foreground">...</p>
        )}
      </Card>

      <div className="space-y-3">
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
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('manage.columns.name')}</TableHead>
                <TableHead>{t('manage.columns.level')}</TableHead>
                <TableHead>{t('manage.columns.address')}</TableHead>
                <TableHead>{t('manage.columns.capacity')}</TableHead>
                <TableHead>{t('manage.columns.actions')}</TableHead>
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
                              used: 0,
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
                              onClick={() => {
                                setSelected(item)
                                setDeleteOpen(true)
                              }}
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
      </div>

      {mode ? (
        <ItemFormDialog
          key={`${selected?.id ?? 'new'}-${formOpen}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={mode}
          item={selected}
        />
      ) : null}
      <ItemDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        item={selected}
      />
    </div>
  )
}
