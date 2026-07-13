import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseLevelsQueryOptions,
  useReplacePhysicalWarehouseLevels,
} from '@/features/physical-warehouse/queries'

type DraftLevel = {
  key: string
  levelName: string
  levelOrder: number
}

export function WarehouseConfigPage() {
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
  const countLocked = levels.length > 0 && sampleChildren.length > 0

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
        levelName: level.levelName,
        levelOrder: level.levelOrder,
      })),
    )
  }, [levels])

  function addLevel() {
    if (countLocked) return
    setDrafts((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        levelName: '',
        levelOrder: prev.length + 1,
      },
    ])
  }

  function removeLevel(key: string) {
    if (countLocked) return
    setDrafts((prev) =>
      prev
        .filter((d) => d.key !== key)
        .map((d, index) => ({ ...d, levelOrder: index + 1 })),
    )
  }

  function updateName(key: string, levelName: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, levelName } : d)),
    )
  }

  function move(key: string, direction: -1 | 1) {
    if (countLocked) return
    setDrafts((prev) => {
      const index = prev.findIndex((d) => d.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[target]!
      next[target] = tmp
      return next.map((d, i) => ({ ...d, levelOrder: i + 1 }))
    })
  }

  async function handleSave() {
    const levelsPayload = drafts
      .map((d, i) => ({
        levelName: d.levelName.trim(),
        levelOrder: i + 1,
      }))
      .filter((d) => d.levelName.length > 0)

    if (levelsPayload.length === 0) return

    await replaceLevels.mutateAsync({ levels: levelsPayload })
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('config.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('config.description')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('config.hint')}</p>
        {countLocked ? (
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
            {drafts.map((draft, index) => (
              <div
                key={draft.key}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="w-8 text-sm text-muted-foreground">
                  {index + 1}.
                </span>
                <Input
                  className="max-w-xs"
                  value={draft.levelName}
                  onChange={(e) => updateName(draft.key, e.target.value)}
                  placeholder={t('config.levelName')}
                />
                {!countLocked ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => move(draft.key, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === drafts.length - 1}
                      onClick={() => move(draft.key, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLevel(draft.key)}
                      disabled={drafts.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!countLocked ? (
            <Button type="button" variant="outline" onClick={addLevel}>
              <Plus className="mr-1 size-4" />
              {t('config.addLevel')}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              replaceLevels.isPending ||
              drafts.every((d) => !d.levelName.trim())
            }
          >
            {replaceLevels.isPending ? t('config.saving') : t('config.save')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
