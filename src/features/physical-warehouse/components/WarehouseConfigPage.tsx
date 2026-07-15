import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TextBlock } from '@/components/common/TextBlock'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseLevelsQueryOptions,
  useReplacePhysicalWarehouseLevels,
} from '@/features/physical-warehouse/queries'

type DraftLevel = {
  key: string
  id?: string
  levelName: string
  levelOrder: number
  pendingRemove?: boolean
}

interface WarehouseConfigPageProps {
  embedded?: boolean
}

export function WarehouseConfigPage({
  embedded = false,
}: WarehouseConfigPageProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageConfig } = usePhysicalWarehouseAccess()
  const { data: levels = [], isPending } = useQuery(
    physicalWarehouseLevelsQueryOptions(),
  )
  const { data: roots = [] } = useQuery(physicalWarehouseItemsQueryOptions())
  const { data: sampleChildren = [] } = useQuery({
    ...physicalWarehouseItemsQueryOptions(roots[0]?.id),
    enabled: Boolean(roots[0]?.id),
  })
  const replaceLevels = useReplacePhysicalWarehouseLevels()

  const [drafts, setDrafts] = useState<Array<DraftLevel>>([])
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false)

  const hasWarehouseData = levels.length > 0 && sampleChildren.length > 0
  const existingIds = useMemo(
    () => new Set(levels.map((level) => level.id)),
    [levels],
  )

  const newLevelCount = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          !draft.pendingRemove &&
          (!draft.id || !existingIds.has(draft.id)),
      ).length,
    [drafts, existingIds],
  )

  const removedLevelCount = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          draft.pendingRemove &&
          Boolean(draft.id && existingIds.has(draft.id)),
      ).length,
    [drafts, existingIds],
  )

  const structureChanged = newLevelCount > 0 || removedLevelCount > 0

  useEffect(() => {
    if (levels.length === 0) {
      setDrafts([
        { key: crypto.randomUUID(), levelName: 'Kho', levelOrder: 1 },
        { key: crypto.randomUUID(), levelName: 'Giá', levelOrder: 2 },
        { key: crypto.randomUUID(), levelName: 'Kệ', levelOrder: 3 },
        { key: crypto.randomUUID(), levelName: 'Hộp', levelOrder: 4 },
      ])
      return
    }
    setDrafts(
      levels.map((level) => ({
        key: level.id,
        id: level.id,
        levelName: level.levelName,
        levelOrder: level.levelOrder,
      })),
    )
  }, [levels])

  function addLevel() {
    setDrafts((prev) => {
      if (prev.length === 0) {
        return [
          {
            key: crypto.randomUUID(),
            levelName: '',
            levelOrder: 1,
          },
        ]
      }
      const insertAt = Math.max(0, prev.length - 1)
      const next = [...prev]
      next.splice(insertAt, 0, {
        key: crypto.randomUUID(),
        levelName: '',
        levelOrder: insertAt + 1,
      })
      return next.map((d, i) => ({ ...d, levelOrder: i + 1 }))
    })
  }

  function removeLevel(key: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.key === key)
      if (!target) return prev

      if (target.pendingRemove) {
        return prev.map((d) =>
          d.key === key ? { ...d, pendingRemove: false } : d,
        )
      }

      const activeCount = prev.filter((d) => !d.pendingRemove).length
      if (activeCount <= 1) return prev

      const lastActive = prev.filter((d) => !d.pendingRemove).at(-1)
      if (hasWarehouseData && lastActive?.key === key) {
        toast.error(t('config.cannotRemoveBottom'))
        return prev
      }

      if (!target.id || !existingIds.has(target.id)) {
        return prev
          .filter((d) => d.key !== key)
          .map((d, index) => ({ ...d, levelOrder: index + 1 }))
      }

      return prev.map((d) =>
        d.key === key ? { ...d, pendingRemove: true } : d,
      )
    })
  }

  function updateName(key: string, levelName: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, levelName } : d)),
    )
  }

  function move(key: string, direction: -1 | 1) {
    setDrafts((prev) => {
      const index = prev.findIndex((d) => d.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      if (prev[index]?.pendingRemove) return prev

      if (hasWarehouseData) {
        const active = prev.filter((d) => !d.pendingRemove)
        const activeIndex = active.findIndex((d) => d.key === key)
        const activeTarget = activeIndex + direction
        if (activeIndex < 0 || activeTarget < 0 || activeTarget >= active.length) {
          return prev
        }
        if (activeTarget === active.length - 1) {
          toast.error(t('config.bottomPinned'))
          return prev
        }
      }

      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((d, i) => ({ ...d, levelOrder: i + 1 }))
    })
  }

  function buildLevelsPayload() {
    return drafts
      .filter((d) => !d.pendingRemove)
      .map((d, i) => ({
        id: d.id && existingIds.has(d.id) ? d.id : undefined,
        levelName: d.levelName.trim(),
        levelOrder: i + 1,
      }))
      .filter((d) => d.levelName.length > 0)
  }

  function handleSaveClick() {
    const levelsPayload = buildLevelsPayload()
    if (levelsPayload.length === 0) return

    if (hasWarehouseData && structureChanged) {
      setMigrateDialogOpen(true)
      return
    }

    void saveLevels(false)
  }

  async function saveLevels(migrateData: boolean) {
    const levelsPayload = buildLevelsPayload()
    if (levelsPayload.length === 0) return

    await replaceLevels.mutateAsync({
      levels: levelsPayload,
      migrateData: migrateData || undefined,
    })
    setMigrateDialogOpen(false)
  }

  if (!canManageConfig) {
    return (
      <Card className="p-6">
        <TextBlock>{t('errors.loadFailed')}</TextBlock>
      </Card>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        {!embedded ? (
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('config.title')}
          </h1>
        ) : (
          <h2 className="text-lg font-medium">{t('config.title')}</h2>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {t('config.description')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('config.hint')}</p>
        {hasWarehouseData ? (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {t('config.lockedHint')}
          </p>
        ) : null}
      </div>

      <Card className="space-y-4 p-4">
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('config.empty')}</p>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft, index) => {
              const activeDrafts = drafts.filter((d) => !d.pendingRemove)
              const isBottom =
                activeDrafts.at(-1)?.key === draft.key && !draft.pendingRemove
              const canRemove =
                (draft.pendingRemove ||
                  activeDrafts.length > 1) &&
                !(hasWarehouseData && isBottom)
              const canMoveUp =
                !draft.pendingRemove &&
                index > 0 &&
                !(hasWarehouseData && isBottom)
              const activeIndex = activeDrafts.findIndex(
                (d) => d.key === draft.key,
              )
              const canMoveDown =
                !draft.pendingRemove &&
                index < drafts.length - 1 &&
                !(
                  hasWarehouseData &&
                  activeIndex >= 0 &&
                  activeIndex === activeDrafts.length - 2
                )

              return (
                <div
                  key={draft.key}
                  className={cn(
                    'flex flex-wrap items-center gap-2',
                    draft.pendingRemove && 'opacity-60',
                  )}
                >
                  <span className="w-8 text-sm text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Input
                    className="max-w-xs"
                    value={draft.levelName}
                    onChange={(e) => updateName(draft.key, e.target.value)}
                    placeholder={t('config.levelName')}
                    disabled={draft.pendingRemove}
                  />
                  {hasWarehouseData && isBottom ? (
                    <span className="text-xs text-muted-foreground">
                      {t('config.bottomBadge')}
                    </span>
                  ) : null}
                  {!draft.id || !existingIds.has(draft.id) ? (
                    <span className="text-xs text-primary">
                      {t('config.newLevelBadge')}
                    </span>
                  ) : null}
                  {draft.pendingRemove ? (
                    <span className="text-xs text-destructive">
                      {t('config.removedLevelBadge')}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canMoveUp}
                    onClick={() => move(draft.key, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canMoveDown}
                    onClick={() => move(draft.key, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLevel(draft.key)}
                    disabled={!canRemove}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addLevel}>
            <Plus className="mr-1 size-4" />
            {t('config.addLevel')}
          </Button>
          <Button
            type="button"
            onClick={handleSaveClick}
            disabled={
              replaceLevels.isPending ||
              drafts
                .filter((d) => !d.pendingRemove)
                .every((d) => !d.levelName.trim())
            }
          >
            {replaceLevels.isPending ? t('config.saving') : t('config.save')}
          </Button>
        </div>
      </Card>

      <AlertDialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('config.migrateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('config.migrateDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replaceLevels.isPending}>
              {t('form.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={replaceLevels.isPending}
              onClick={(event) => {
                event.preventDefault()
                void saveLevels(true)
              }}
            >
              {t('config.migrateConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
