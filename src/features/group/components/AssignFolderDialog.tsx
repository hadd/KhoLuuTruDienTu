import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import { isProjectScopedDataRole } from '@/features/data-management/config/roleConfig'
import { useDataManagementRole } from '@/features/data-management/hooks/useDataManagementRole'
import {
  filterTreeFoldersOnly,
  filterTreeForSearch,
} from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryOptions,
  refreshDataManagementTreeQuery,
  useLoadNodeChildrenMutation,
} from '@/features/data-management/queries'
import { buildAssignGroupByFolderPayload } from '@/features/group/lib/buildAssignGroupByFolderPayload'
import { useAssignGroupByFolderMutation } from '@/features/group/queries'
import type { Group } from '@/features/group/types'
import { translateError } from '@/lib/utils/translate-error'

interface AssignFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
  dossiersPerEditor: number
}

export function AssignFolderDialog({
  open,
  onOpenChange,
  group,
  dossiersPerEditor,
}: AssignFolderDialogProps) {
  const { t } = useTranslation('group')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const role = useDataManagementRole()
  const canExpandNodes = isProjectScopedDataRole(role)
  const projectCode = group?.projectCode?.trim() || undefined
  const canFetchTree =
    open && (!isProjectScopedDataRole(role) || Boolean(projectCode))

  const {
    data: tree,
    isPending: isLoadingTree,
    isError: isTreeError,
  } = useQuery({
    ...dataManagementTreeQueryOptions(role, projectCode),
    enabled: canFetchTree,
  })

  useEffect(() => {
    if (!canFetchTree) return
    void refreshDataManagementTreeQuery(queryClient, role, projectCode)
  }, [canFetchTree, projectCode, queryClient, role])

  const { mutateAsync: loadNodeChildrenAsync } = useLoadNodeChildrenMutation(
    role,
    projectCode,
  )

  const assignMutation = useAssignGroupByFolderMutation()
  const [selectedFolderIds, setSelectedFolderIds] = useState<Array<string>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const treeScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedFolderIds([])
  }, [group?.id, projectCode])

  const handleToggleFolder = useCallback((folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId],
    )
  }, [])

  const filteredTree = useMemo(() => {
    if (!tree) return null
    const foldersOnly = filterTreeFoldersOnly(tree)
    if (!searchQuery.trim()) return foldersOnly
    return filterTreeForSearch(foldersOnly, searchQuery)
  }, [tree, searchQuery])

  useEffect(() => {
    if (!open || !tree) return

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
  }, [open, tree])

  const handleExpandNode = useCallback(
    (nodeId: string) => {
      if (!canExpandNodes) return
      void loadNodeChildrenAsync(nodeId)
    },
    [canExpandNodes, loadNodeChildrenAsync],
  )

  const handleSubmit = async () => {
    if (!group || selectedFolderIds.length === 0) return

    try {
      const result = await assignMutation.mutateAsync({
        groupId: group.id,
        payload: buildAssignGroupByFolderPayload(
          selectedFolderIds,
          dossiersPerEditor,
        ),
      })

      await refreshDataManagementTreeQuery(queryClient, role, projectCode)

      toast.success(
        t('assignFolder.success', {
          count: result.totalAssigned,
          groupName: result.group.name,
          checkerCount: result.checkerAssignmentsCreated,
        }),
      )

      setSelectedFolderIds([])
      onOpenChange(false)
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedFolderIds([])
          setSearchQuery('')
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('assignFolder.title')}</DialogTitle>
          <DialogDescription>
            {t('assignFolder.description', { name: group?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 shrink-0">
            {isLoadingTree ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isTreeError ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 p-4 text-center text-sm">
                <p className="text-destructive">{t('assignFolder.loadFailed')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void refreshDataManagementTreeQuery(
                      queryClient,
                      role,
                      projectCode,
                    )
                  }
                >
                  {t('assignFolder.retry')}
                </Button>
              </div>
            ) : filteredTree ? (
              <div className="flex flex-col gap-2">
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('assignFolder.searchPlaceholder')}
                    className="pl-8"
                  />
                </div>
                <div
                  ref={treeScrollRef}
                  className="h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1 pr-2"
                >
                  <DataFolderTree
                    tree={filteredTree}
                    multiSelect
                    selectedIds={selectedFolderIds}
                    onSelect={handleToggleFolder}
                    onExpandNode={canExpandNodes ? handleExpandNode : undefined}
                    scrollable={false}
                  />
                </div>
                {selectedFolderIds.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('assignFolder.selectedCount', {
                      count: selectedFolderIds.length,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {projectCode
                  ? t('assignFolder.noData')
                  : t('assignFolder.noProject')}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            {tCommon('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              selectedFolderIds.length === 0 || assignMutation.isPending
            }
            onClick={() => void handleSubmit()}
          >
            {assignMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t('assignFolder.submit')}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
