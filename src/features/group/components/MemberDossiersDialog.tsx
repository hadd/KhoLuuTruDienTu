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
  groupMemberAssignmentsQueryKey,
  groupMemberAssignmentsQueryOptions,
} from '@/features/group/queries'
import type { MemberDossiersTargetT } from '@/features/group/types'

interface MemberDossiersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  target: MemberDossiersTargetT | null
}

export function MemberDossiersDialog({
  open,
  onOpenChange,
  groupId,
  target,
}: MemberDossiersDialogProps) {
  const { t } = useTranslation('group')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const treeScrollRef = useRef<HTMLDivElement>(null)

  const query = useMemo(() => {
    if (!target) return null
    return {
      userId: target.userId,
      kind: target.kind,
      ...(target.kind === 'checker' && target.level != null
        ? { level: target.level }
        : {}),
    }
  }, [target])

  const {
    data,
    isPending: isLoading,
    isError,
    refetch,
  } = useQuery({
    ...groupMemberAssignmentsQueryOptions(groupId, query),
    enabled: open && Boolean(groupId) && Boolean(query?.userId),
  })

  const dossiers = data?.dossiers ?? []

  const dossierTree = useMemo(() => {
    if (!dossiers.length) return null
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
    if (!query) return
    void queryClient.invalidateQueries({
      queryKey: groupMemberAssignmentsQueryKey(groupId, query),
    })
    void refetch()
  }

  const title =
    target?.kind === 'checker'
      ? t('memberDossiers.checkerTitle', {
          name: target.name,
          level: target.level ?? 1,
        })
      : t('memberDossiers.editorTitle', { name: target?.name ?? '' })

  const description =
    target?.kind === 'checker'
      ? t('memberDossiers.checkerDescription', {
          name: target.name,
          level: target.level ?? 1,
        })
      : t('memberDossiers.editorDescription', { name: target?.name ?? '' })

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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
                  {t('memberDossiers.loadFailed')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  {t('memberDossiers.retry')}
                </Button>
              </div>
            ) : filteredTree && hasVisibleNodes ? (
              <div className="flex flex-col gap-2">
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('memberDossiers.searchPlaceholder')}
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
                <p className="text-sm text-muted-foreground">
                  {t('memberDossiers.count', { count: dossiers.length })}
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {target?.kind === 'checker'
                  ? t('memberDossiers.checkerEmpty')
                  : t('memberDossiers.editorEmpty')}
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
