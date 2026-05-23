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

type AssignmentTarget = 'editor' | 'reviewer2' | 'reviewer3'

const assignmentTargetConfig: Record<
  AssignmentTarget,
  { labelKey: string; role: 'editor' | 'reviewer' }
> = {
  editor: { labelKey: 'actionDialog.assign.roleLabels.leader', role: 'editor' },
  reviewer2: {
    labelKey: 'actionDialog.assign.roleLabels.reviewer2',
    role: 'reviewer',
  },
  reviewer3: {
    labelKey: 'actionDialog.assign.roleLabels.reviewer3',
    role: 'reviewer',
  },
}

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
  const [assignmentCount, setAssignmentCount] = useState(1)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const assignmentOptionsByTarget = useMemo(() => {
    const editors = assignees.filter((assignee) => assignee.role === 'editor')
    const reviewers = assignees.filter((assignee) => assignee.role === 'reviewer')
    const byRole = { editor: editors, reviewer: reviewers }
    return {
      editor: byRole[assignmentTargetConfig.editor.role],
      reviewer2: byRole[assignmentTargetConfig.reviewer2.role],
      reviewer3: byRole[assignmentTargetConfig.reviewer3.role],
    }
  }, [assignees])
  const assignmentTargets = useMemo<Array<AssignmentTarget>>(() => {
    const clamped = Math.min(Math.max(assignmentCount, 1), 3)
    if (clamped === 1) return ['editor']
    if (clamped === 2) return ['editor', 'reviewer2']
    return ['editor', 'reviewer2', 'reviewer3']
  }, [assignmentCount])
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
    if (mode !== 'assign') return
    setAssignmentCount(1)
  }, [mode])

  useEffect(() => {
    if (mode !== 'assign') return
    setAssignments((prev) => {
      const next: Record<string, string> = {}
      for (const target of assignmentTargets) {
        const options = assignmentOptionsByTarget[target]
        const prevValue = prev[target]
        if (prevValue && options.some((option) => option.id === prevValue)) {
          next[target] = prevValue
        } else {
          next[target] = options[0]?.id ?? ''
        }
      }
      return next
    })
  }, [assignmentTargets, assignmentOptionsByTarget, mode])

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
      if (currentMode === 'assign') {
        for (const target of assignmentTargets) {
          const assigneeId = assignments[target]
          if (!assigneeId) continue
          await assignMutation.mutateAsync({
            id: node.id,
            assigneeId,
            target,
          })
        }
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
            <div className="space-y-2">
              <Label htmlFor="assignment-count">
                {t('actionDialog.assign.countLabel')}
              </Label>
              <Input
                id="assignment-count"
                type="number"
                min={1}
                max={3}
                value={assignmentCount}
                onChange={(event) => {
                  const raw = event.target.value
                  const parsed = Number(raw)
                  if (!raw || Number.isNaN(parsed)) {
                    setAssignmentCount(1)
                    return
                  }
                  setAssignmentCount(Math.min(Math.max(parsed, 1), 3))
                }}
                placeholder={t('actionDialog.assign.countPlaceholder')}
              />
            </div>
            <div className="space-y-3">
              {assignmentTargets.map((target) => {
                const options = assignmentOptionsByTarget[target]
                const labelKey = assignmentTargetConfig[target].labelKey
                return (
                  <div key={target} className="space-y-2">
                    <Label>{t(labelKey as any)}</Label>
                    <Select
                      value={assignments[target] ?? ''}
                      onValueChange={(value) =>
                        setAssignments((prev) => ({ ...prev, [target]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('actionDialog.assign.assigneePlaceholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((assignee) => (
                          <SelectItem key={assignee.id} value={assignee.id}>
                            {assignee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
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
            disabled={
              isPending ||
              (mode === 'assign' &&
                assignmentTargets.some((target) => !assignments[target]))
            }
          >
            {t(`actionDialog.${mode}.submit` as const)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
