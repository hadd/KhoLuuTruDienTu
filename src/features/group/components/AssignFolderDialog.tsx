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
import {
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
} from '@/features/data-management/queries'
import { useAssignGroupByFolderMutation } from '@/features/group/queries'
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

  const { data: tree, isLoading: isLoadingTree } = useQuery({
    ...dataManagementTreeQueryOptions(role),
    enabled: open,
  })

  const assignMutation = useAssignGroupByFolderMutation()
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const treeScrollRef = useRef<HTMLDivElement>(null)

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
      const updatedTree = await loadNodeChildren(nodeId, role)
      queryClient.setQueryData(dataManagementTreeQueryKey(role), updatedTree)
    },
    [isAdmin, role, queryClient],
  )

  const handleSubmit = async () => {
    if (!group || !selectedFolderId) return

    try {
      const result = await assignMutation.mutateAsync({
        groupId: group.id,
        payload: {
          folderId: selectedFolderId,
          dossiersPerEditor,
        },
      })

      toast.success(
        t('assignFolder.success', {
          count: result.totalAssigned,
          groupName: result.group.name,
        }),
      )

      await queryClient.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role),
      })

      onOpenChange(false)
      setSelectedFolderId(undefined)
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedFolderId(undefined)
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
                  selectedId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                  onExpandNode={isAdmin ? handleExpandNode : undefined}
                  scrollable={false}
                />
              </div>
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
            disabled={!selectedFolderId || assignMutation.isPending}
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
