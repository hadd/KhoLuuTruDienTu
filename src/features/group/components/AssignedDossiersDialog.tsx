import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import { filterTreeForSearch } from '@/features/data-management/lib/treeUtils'
import { buildAssignedDossierTree } from '@/features/group/lib/buildAssignedDossierTree'
import {
  assignedGroupDossiersQueryKey,
  assignedGroupDossiersQueryOptions,
} from '@/features/group/queries'
import type { Group } from '@/features/group/types'

interface AssignedDossiersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
}

export function AssignedDossiersDialog({
  open,
  onOpenChange,
  group,
}: AssignedDossiersDialogProps) {
  const { t } = useTranslation('group')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const groupId = group?.id ?? ''
  const [searchQuery, setSearchQuery] = useState('')
  const treeScrollRef = useRef<HTMLDivElement>(null)

  const {
    data: dossiers,
    isPending: isLoading,
    isError,
    refetch,
  } = useQuery({
    ...assignedGroupDossiersQueryOptions(groupId),
    enabled: open && Boolean(groupId),
  })

  const dossierTree = useMemo(() => {
    if (!dossiers?.length) return null
    return buildAssignedDossierTree(dossiers)
  }, [dossiers])

  const filteredTree = useMemo(() => {
    if (!dossierTree) return null
    if (!searchQuery.trim()) return dossierTree
    return filterTreeForSearch(dossierTree, searchQuery)
  }, [dossierTree, searchQuery])

  const hasVisibleNodes = (filteredTree?.children.length ?? 0) > 0

  useEffect(() => {
    if (!open || !filteredTree) return

    const scrollContainer = treeScrollRef.current
    if (!scrollContainer) return

    const handleWheel = (event: WheelEvent) => {
      if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return
      event.stopPropagation()
      event.preventDefault()
      scrollContainer.scrollTop += event.deltaY
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollContainer.removeEventListener('wheel', handleWheel)
  }, [filteredTree, open])

  const handleSelect = useCallback(() => {
    // Read-only tree — expand/collapse only via chevron buttons in DataFolderTree
  }, [])

  const handleRetry = () => {
    void queryClient.invalidateQueries({
      queryKey: assignedGroupDossiersQueryKey(groupId),
    })
    void refetch()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSearchQuery('')
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('assignedDossiers.title')}</DialogTitle>
          <DialogDescription>
            {t('assignedDossiers.description', { name: group?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 shrink-0">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 p-4 text-center text-sm">
                <p className="text-destructive">
                  {t('assignedDossiers.loadFailed')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  {t('assignedDossiers.retry')}
                </Button>
              </div>
            ) : filteredTree && hasVisibleNodes ? (
              <div className="flex flex-col gap-2">
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('assignedDossiers.searchPlaceholder')}
                    className="pl-8"
                  />
                </div>
                <div
                  ref={treeScrollRef}
                  className="h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1 pr-2"
                >
                  <DataFolderTree
                    tree={filteredTree}
                    onSelect={handleSelect}
                    scrollable={false}
                  />
                </div>
                {dossiers?.length ? (
                  <p className="text-sm text-muted-foreground">
                    {t('assignedDossiers.count', { count: dossiers.length })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('assignedDossiers.empty')}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('common.cancel')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
