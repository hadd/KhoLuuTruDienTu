import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { useGroupAccess } from '@/features/group/hooks/useGroupAccess'
import { buildAssignedDossierTree } from '@/features/group/lib/buildAssignedDossierTree'
import {
  assignedGroupDossiersQueryKey,
  assignedGroupDossiersQueryOptions,
  useRevokeGroupAllAssignmentsMutation,
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
  const { canRevokeGroupAssignments } = useGroupAccess()
  const groupId = group?.id ?? ''
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false)
  const treeScrollRef = useRef<HTMLDivElement>(null)
  const revokeMutation = useRevokeGroupAllAssignmentsMutation()

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
  const hasDossiers = Boolean(dossiers?.length)
  const hasActiveSearch = Boolean(searchQuery.trim())
  const showRevokeAll =
    canRevokeGroupAssignments && hasDossiers && !isLoading && !isError

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

  const handleConfirmRevoke = () => {
    if (!groupId) return
    revokeMutation.mutate(groupId, {
      onSuccess: () => {
        setConfirmRevokeOpen(false)
      },
    })
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSearchQuery('')
            setConfirmRevokeOpen(false)
          }
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
              ) : hasDossiers ? (
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
                  {filteredTree && hasVisibleNodes ? (
                    <>
                      <div
                        ref={treeScrollRef}
                        className="h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1 pr-2"
                      >
                        <DataFolderTree
                          tree={filteredTree}
                          onSelect={handleSelect}
                          scrollable={false}
                          showAssignee
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('assignedDossiers.count', { count: dossiers.length })}
                      </p>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {hasActiveSearch
                        ? t('assignedDossiers.noSearchResults')
                        : t('assignedDossiers.empty')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('assignedDossiers.empty')}
                </p>
              )}
            </div>

            <DialogFooter className="shrink-0 gap-2 sm:justify-between">
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={revokeMutation.isPending}
                >
                  {tCommon('common.cancel')}
                </Button>
                {showRevokeAll ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmRevokeOpen(true)}
                    disabled={revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {t('assignedDossiers.revokeAll.button')}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmRevokeOpen}
        onOpenChange={(nextOpen) => {
          if (revokeMutation.isPending) return
          setConfirmRevokeOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('assignedDossiers.revokeAll.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('assignedDossiers.revokeAll.confirmDescription', {
                name: group?.name ?? '',
                count: dossiers?.length ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              {tCommon('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                handleConfirmRevoke()
              }}
            >
              {revokeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t('assignedDossiers.revokeAll.confirmSubmit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
