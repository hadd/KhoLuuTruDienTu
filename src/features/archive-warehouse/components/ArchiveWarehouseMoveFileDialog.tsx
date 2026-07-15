import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { moveArchiveWarehouseFile } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import {
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondsQueryKey,
  archiveWarehouseFondsQueryOptions,
} from '@/features/archive-warehouse/queries'
import { translateError } from '@/lib/utils/translate-error'

type ArchiveWarehouseMoveFileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  fileId: string
  fileName: string
  fondId: string
  onMoved: () => void
}

export function ArchiveWarehouseMoveFileDialog({
  open,
  onOpenChange,
  dossierId,
  fileId,
  fileName,
  fondId,
  onMoved,
}: ArchiveWarehouseMoveFileDialogProps) {
  const { t } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [targetFondId, setTargetFondId] = useState(fondId)
  const [targetDossierId, setTargetDossierId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTargetFondId(fondId)
      setTargetDossierId(null)
      setFilter('')
    }
  }, [fondId, open])

  const fondsQuery = useQuery({
    ...archiveWarehouseFondsQueryOptions(),
    enabled: open,
  })

  const dossiersQuery = useQuery({
    ...archiveWarehouseDossiersQueryOptions({
      fondId: targetFondId,
      page: 1,
      limit: 100,
      status: 'ARCHIVED',
    }),
    enabled: open && Boolean(targetFondId),
  })

  const fondOptions = fondsQuery.data?.items ?? []

  const candidates = useMemo(() => {
    const items = dossiersQuery.data?.items ?? []
    const q = filter.trim().toLowerCase()
    return items
      .filter((item) => item.id !== dossierId)
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q),
      )
  }, [dossierId, dossiersQuery.data?.items, filter])

  const mutation = useMutation({
    mutationFn: () => {
      if (!targetDossierId) {
        throw new Error(t('move.selectTarget'))
      }
      return moveArchiveWarehouseFile(dossierId, fileId, targetDossierId)
    },
    onSuccess: async (result) => {
      toast.success(result.message || t('move.success'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['archive-warehouse'] }),
        queryClient.invalidateQueries({ queryKey: archiveWarehouseFondsQueryKey }),
      ])
      onOpenChange(false)
      setTargetDossierId(null)
      setFilter('')
      setTargetFondId(fondId)
      onMoved()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? translateError(error) : t('move.failed'),
      )
    },
  })

  function resetLocalState() {
    setTargetDossierId(null)
    setFilter('')
    setTargetFondId(fondId)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        onOpenChange(next)
        if (!next) resetLocalState()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('move.title')}</DialogTitle>
          <DialogDescription>
            {t('move.description', { fileName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="move-target-fond">{t('move.fondLabel')}</Label>
          <Select
            value={targetFondId}
            onValueChange={(nextFondId) => {
              setTargetFondId(nextFondId)
              setTargetDossierId(null)
              setFilter('')
            }}
            disabled={fondsQuery.isPending || mutation.isPending}
          >
            <SelectTrigger id="move-target-fond" className="w-full">
              <SelectValue placeholder={t('move.fondPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {fondOptions.map((fond) => (
                <SelectItem key={fond.id} value={fond.id}>
                  {fond.fondName || fond.id}
                  {fond.id === fondId ? ` (${t('move.currentFond')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {targetFondId !== fondId ? (
            <p className="text-xs text-muted-foreground">{t('move.crossFondHint')}</p>
          ) : null}
        </div>

        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('move.searchPlaceholder')}
        />

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {fondsQuery.isPending || dossiersQuery.isPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : fondOptions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {t('move.emptyFonds')}
            </p>
          ) : candidates.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {t('move.emptyTargets')}
            </p>
          ) : (
            candidates.map((item) => {
              const active = item.id === targetDossierId
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    active
                      ? 'w-full rounded-md bg-primary/10 px-3 py-2 text-left text-sm'
                      : 'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted'
                  }
                  onClick={() => setTargetDossierId(item.id)}
                >
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.id}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('move.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!targetDossierId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('move.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
