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
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import { loadNodeChildren } from '@/features/data-management/api/dataManagementClient'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  filterTreeFoldersOnly,
  filterTreeForSearch,
} from '@/features/data-management/lib/treeUtils'
import { useDataManagementProjectSelection } from '@/features/data-management/hooks/useDataManagementProjectSelection'
import {
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
} from '@/features/data-management/queries'
import { useAssignGroupByFolderMutation } from '@/features/group/queries'
import { buildAssignGroupByFolderPayload } from '@/features/group/lib/buildAssignGroupByFolderPayload'
import { GroupAssignPreview } from '@/features/group/components/GroupAssignPreview'
import type { Group } from '@/features/group/types'
import { translateError } from '@/lib/utils/translate-error'

function getDataRoleForUser(): DataManagementRole {
  const roles = getUserRoles()
  return getPrimaryAppRole(roles) ?? 'editor'
}

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
  const role = getDataRoleForUser()
  const isAdmin = role === 'admin'
  const { projectCode } = useDataManagementProjectSelection()

  const { data: tree, isLoading: isLoadingTree } = useQuery({
    ...dataManagementTreeQueryOptions(role, projectCode),
    enabled: open && (role !== 'admin' || Boolean(projectCode?.trim())),
  })

  const assignMutation = useAssignGroupByFolderMutation()
  const [selectedFolderIds, setSelectedFolderIds] = useState<Array<string>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const treeScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedFolderIds([])
  }, [projectCode])

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
  }, [open, filteredTree])

  const handleExpandNode = useCallback(
    async (nodeId: string) => {
      if (!isAdmin) return
      const result = await loadNodeChildren(nodeId, role, { projectCode })
      if (result.changed) {
        queryClient.setQueryData(
          dataManagementTreeQueryKey(role, projectCode),
          result.tree,
        )
      }
    },
    [isAdmin, projectCode, role, queryClient],
  )

  const handleSubmit = async () => {
    if (!group || selectedFolderIds.length === 0) return

    try {
      const result = await assignMutation.mutateAsync({
        groupId: group.id,
        payload: buildAssignGroupByFolderPayload(selectedFolderIds, dossiersPerEditor),
      })

      toast.success(
        t('assignFolder.success', {
          count: result.totalAssigned,
          groupName: result.group.name,
          checkerCount: result.checkerAssignmentsCreated,
        }),
      )

      await queryClient.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCode),
      })

      onOpenChange(false)
      setSelectedFolderIds([])
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

        {group ? <GroupAssignPreview group={group} /> : null}

        <div className="min-h-0 shrink-0">
          {isLoadingTree ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
                  onExpandNode={isAdmin ? handleExpandNode : undefined}
                  scrollable={false}
                />
              </div>
              {selectedFolderIds.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('assignFolder.selectedCount', { count: selectedFolderIds.length })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('assignFolder.noData')}
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
            onClick={() => void handleSubmit()}
            disabled={selectedFolderIds.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t('assignFolder.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
