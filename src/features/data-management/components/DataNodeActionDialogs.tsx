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
import {
  getMockDataAssignees,
  getRecordAssignmentTarget,
} from '@/features/data-management/api/dataManagementClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  useAddDataDocumentMutation,
  useAddDataFolderMutation,
  useAssignDataRecordMutation,
  useDeleteDataNodeMutation,
  useRenameDataNodeMutation,
} from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'

export type DataNodeActionDialogMode = 'rename' | 'delete' | 'addDocument' | 'addFolder' | 'assign'

export function DataNodeActionDialogs({
  node,
  mode,
  onOpenChange,
  role,
}: {
  node: DataTreeNodeT | null
  mode: DataNodeActionDialogMode | null
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const [name, setName] = useState('')
  const assignees = useMemo(() => getMockDataAssignees(), [])
  const assignmentTarget = getRecordAssignmentTarget(node?.recordStatus)
  const assignmentOptions = useMemo(
    () =>
      assignees.filter((assignee) =>
        assignmentTarget === 'editor'
          ? assignee.role === 'editor'
          : assignee.role === 'reviewer',
      ),
    [assignees, assignmentTarget],
  )
  const [assigneeId, setAssigneeId] = useState('')
  const renameMutation = useRenameDataNodeMutation(role)
  const deleteMutation = useDeleteDataNodeMutation(role)
  const addDocumentMutation = useAddDataDocumentMutation(role)
  const addFolderMutation = useAddDataFolderMutation(role)
  const assignMutation = useAssignDataRecordMutation(role)
  const open = Boolean(node && mode)

  useEffect(() => {
    setName(node?.name ?? '')
  }, [node?.name])

  useEffect(() => {
    setAssigneeId(assignmentOptions[0]?.id ?? '')
  }, [assignmentOptions])

  if (!node || !mode) return null

  const isPending =
    renameMutation.isPending ||
    deleteMutation.isPending ||
    addDocumentMutation.isPending ||
    addFolderMutation.isPending ||
    assignMutation.isPending

  function close() {
    onOpenChange(false)
  }

  function getSuccessMessage(currentMode: DataNodeActionDialogMode) {
    if (currentMode === 'rename') return t('actionDialog.rename.success')
    if (currentMode === 'delete') return t('actionDialog.delete.success')
    if (currentMode === 'addDocument')
      return t('actionDialog.addDocument.success')
    if (currentMode === 'addFolder') return t('actionDialog.addFolder.success')
    return t('actionDialog.assign.success')
  }

  async function handleSubmit() {
    if (!node || !mode) return
    const currentMode = mode
    try {
      if (currentMode === 'rename') {
        await renameMutation.mutateAsync({
          id: node.id,
          name: name.trim() || node.name,
        })
      }
      if (currentMode === 'delete') {
        await deleteMutation.mutateAsync(node.id)
      }
      if (currentMode === 'addDocument') {
        await addDocumentMutation.mutateAsync(node.id)
      }
      if (currentMode === 'addFolder') {
        await addFolderMutation.mutateAsync(node.id)
      }
      if (currentMode === 'assign' && assignmentTarget && assigneeId) {
        await assignMutation.mutateAsync({
          id: node.id,
          assigneeId,
          target: assignmentTarget,
        })
      }
      toast.success(getSuccessMessage(currentMode))
      close()
    } catch {
      toast.error(tCommon('errors.default'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`actionDialog.${mode}.title` as const)}</DialogTitle>
          <DialogDescription>
            {t(`actionDialog.${mode}.description` as const)}
          </DialogDescription>
        </DialogHeader>

        {mode === 'rename' ? (
          <div className="space-y-2">
            <Label htmlFor="data-node-name">
              {t('actionDialog.rename.nameLabel')}
            </Label>
            <Input
              id="data-node-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}

        {mode === 'assign' ? (
          <div className="space-y-2">
            <Label>{t('actionDialog.assign.assigneeLabel')}</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t('actionDialog.assign.assigneePlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {assignmentOptions.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={isPending}
          >
            {tCommon('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={mode === 'delete' ? 'destructive' : 'default'}
            onClick={() => void handleSubmit()}
            disabled={isPending || (mode === 'assign' && !assigneeId)}
          >
            {t(`actionDialog.${mode}.submit` as const)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
