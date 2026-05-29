import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ASSIGN_FOLDER_ROLE,
  EDITOR_USER_ROLE_IDS,
} from '@/features/data-management/lib/constants'

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
import { getAllUsers } from '@/features/user/api/userClient'
import { useQuery } from '@tanstack/react-query'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  useAddDataDocumentMutation,
  useAddDataFolderMutation,
  useAssignDataRecordMutation,
  useAssignDossierEditorMutation,
  useDeleteDataNodeMutation,
  useRenameDataNodeMutation,
  useUpdateDossierMutation,
} from '@/features/data-management/queries'
import {
  fetchDossierIdByFolderId,
  fetchDossierTargetByFolderId,
} from '@/features/data-management/api/dataManagementClient'
import {
  findDescendantDossierTarget,
  resolveAdminAssignFolderId,
  resolveDossierEditorAssignId,
  resolveDossierUpdateId,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { translateError } from '@/lib/utils/translate-error'

export type DataNodeActionDialogMode =
  | 'rename'
  | 'delete'
  | 'addDocument'
  | 'addFolder'
  | 'assign'
  | 'assignEditor'

export function DataNodeActionDialogs({
  node,
  mode,
  onOpenChange,
  role,
  onEnsureNodeLoaded,
}: {
  node: DataTreeNodeT | null
  mode: DataNodeActionDialogMode | null
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
  onEnsureNodeLoaded?: (nodeId: string) => Promise<DataTreeNodeT | null>
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const [name, setName] = useState('')
  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: getAllUsers,
  })
  const assignees = useMemo(() => {
    if (!usersData) return []
    return usersData.items
      .filter((u: any) =>
        u.userRoles?.some(
          (r: any) => r.roleId === 'admin' || r.roleId === 'qc',
        ),
      )
      .map((u: any) => ({ id: u.id, name: u.fullName }))
  }, [usersData])
  const editors = useMemo(() => {
    if (!usersData) return []
    return usersData.items
      .filter((u) =>
        u.userRoles?.some((r) =>
          EDITOR_USER_ROLE_IDS.includes(
            r.roleId as (typeof EDITOR_USER_ROLE_IDS)[number],
          ),
        ),
      )
      .map((u) => ({ id: u.id, name: u.fullName }))
  }, [usersData])
  const [assignmentCount, setAssignmentCount] = useState(1)
  const [assignmentCountInput, setAssignmentCountInput] = useState('1')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [selectedEditorId, setSelectedEditorId] = useState('')
  const assignmentOptions = useMemo(() => assignees, [assignees])
  const assignmentTargets = useMemo<Array<number>>(() => {
    const clamped = Math.min(Math.max(assignmentCount, 1), 100)
    return Array.from({ length: clamped }, (_, index) => index + 1)
  }, [assignmentCount])
  const renameMutation = useRenameDataNodeMutation(role)
  const updateDossierMutation = useUpdateDossierMutation(role)
  const deleteMutation = useDeleteDataNodeMutation(role)
  const addDocumentMutation = useAddDataDocumentMutation(role)
  const addFolderMutation = useAddDataFolderMutation(role)
  const assignMutation = useAssignDataRecordMutation(role)
  const assignEditorMutation = useAssignDossierEditorMutation(role)
  const open = Boolean(node && mode)

  useEffect(() => {
    setName(node?.name ?? '')
  }, [node?.name])

  useEffect(() => {
    if (mode !== 'assign') return
    const count = node?.requiredQcCount ?? 1
    setAssignmentCount(count)
    setAssignmentCountInput(String(count))
  }, [mode, node?.id, node?.requiredQcCount])

  useEffect(() => {
    if (mode !== 'assignEditor') return
    setSelectedEditorId(editors[0]?.id ?? '')
  }, [mode, editors])

  useEffect(() => {
    if (mode !== 'assign') return
    setAssignments((prev) => {
      const next: Record<string, string> = {}
      for (const target of assignmentTargets) {
        const key = String(target)
        const prevValue = prev[key]
        if (
          prevValue &&
          assignmentOptions.some((option) => option.id === prevValue)
        ) {
          next[key] = prevValue
        } else {
          next[key] = assignmentOptions[0]?.id ?? ''
        }
      }
      return next
    })
  }, [assignmentTargets, assignmentOptions, mode])

  if (!node || !mode) return null

  const isPending =
    renameMutation.isPending ||
    deleteMutation.isPending ||
    addDocumentMutation.isPending ||
    addFolderMutation.isPending ||
    assignMutation.isPending ||
    assignEditorMutation.isPending ||
    updateDossierMutation.isPending

  function close() {
    onOpenChange(false)
  }

  function getSuccessMessage(currentMode: DataNodeActionDialogMode) {
    if (currentMode === 'rename') return t('actionDialog.rename.success')
    if (currentMode === 'delete') return t('actionDialog.delete.success')
    if (currentMode === 'addDocument')
      return t('actionDialog.addDocument.success')
    if (currentMode === 'addFolder') return t('actionDialog.addFolder.success')
    if (currentMode === 'assignEditor')
      return t('actionDialog.assignEditor.success')
    return t('actionDialog.assign.success')
  }

  async function handleSubmit() {
    if (!node || !mode) return
    const currentMode = mode
    try {
      if (currentMode === 'rename') {
        const trimmedName = name.trim() || node.name
        if (node.entityType === 'DOCUMENT') {
          const dossierId = resolveDossierUpdateId(node)
          if (!dossierId) {
            toast.error(t('actionDialog.rename.noDossier'))
            return
          }
          await updateDossierMutation.mutateAsync({
            id: dossierId,
            name: trimmedName,
          })
        } else {
          await renameMutation.mutateAsync({
            id: node.id,
            name: trimmedName,
          })
        }
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
        let targetNode = node
        let dossierId = resolveDossierUpdateId(targetNode)
        if (!dossierId && onEnsureNodeLoaded) {
          const loadedNode = await onEnsureNodeLoaded(node.id)
          if (loadedNode) {
            targetNode = loadedNode
            dossierId = resolveDossierUpdateId(loadedNode)
          }
        }
        const folderId = resolveAdminAssignFolderId(targetNode)
        if (!dossierId) {
          dossierId =
            findDescendantDossierTarget(targetNode)?.dossierId ??
            (await fetchDossierIdByFolderId(folderId))
        }
        if (!dossierId) {
          toast.error(t('actionDialog.assign.noDossier'))
          return
        }
        await updateDossierMutation.mutateAsync({
          id: dossierId,
          name: (targetNode.name.trim() || node.name).trim(),
          requiredQcCount: assignmentCount,
        })
        for (const target of assignmentTargets) {
          const assigneeId = assignments[String(target)]
          if (!assigneeId) continue
          await assignMutation.mutateAsync({
            folderId,
            assigneeId,
            role: ASSIGN_FOLDER_ROLE.checker(target),
          })
        }
      }
      if (currentMode === 'assignEditor') {
        if (!selectedEditorId) return
        let targetNode = node
        let dossierId = resolveDossierEditorAssignId(targetNode)
        if (!dossierId && onEnsureNodeLoaded) {
          const loadedNode = await onEnsureNodeLoaded(node.id)
          if (loadedNode) {
            targetNode = loadedNode
            dossierId = resolveDossierEditorAssignId(loadedNode)
          }
        }
        if (!dossierId) {
          dossierId =
            findDescendantDossierTarget(targetNode)?.dossierId ??
            (await fetchDossierTargetByFolderId(targetNode.id))?.dossierId ??
            null
        }
        if (!dossierId) {
          toast.error(t('actionDialog.assignEditor.noFolder'))
          return
        }
        await assignEditorMutation.mutateAsync({
          dossierId,
          assigneeId: selectedEditorId,
        })
      }
      toast.success(getSuccessMessage(currentMode))
      close()
    } catch (error) {
      toast.error(translateError(error))
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
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="assignment-count">
                {t('actionDialog.assign.countLabel')}
              </Label>
              <Input
                id="assignment-count"
                type="number"
                min={1}
                max={100}
                value={assignmentCountInput}
                onChange={(event) => {
                  const raw = event.target.value
                  if (raw === '') {
                    setAssignmentCountInput('')
                    return
                  }
                  if (!/^\d+$/.test(raw)) return
                  setAssignmentCountInput(raw)
                  const parsed = Number(raw)
                  if (parsed >= 1) {
                    setAssignmentCount(Math.min(parsed, 100))
                  }
                }}
                onBlur={() => {
                  if (assignmentCountInput === '') {
                    setAssignmentCount(1)
                    setAssignmentCountInput('1')
                    return
                  }
                  const parsed = Number(assignmentCountInput)
                  const next = Math.min(Math.max(parsed, 1), 100)
                  setAssignmentCount(next)
                  setAssignmentCountInput(String(next))
                }}
                placeholder={t('actionDialog.assign.countPlaceholder')}
              />
            </div>
            <div className="space-y-3">
              {assignmentTargets.map((target) => {
                const options = assignmentOptions
                const label =
                  target === 1 ? 'Leader (duyệt 1)' : `Duyệt ${target}`

                const previousSelectedIds = assignmentTargets
                  .filter((t) => t < target)
                  .map((t) => assignments[String(t)])

                const optionsForThisTarget = options.filter(
                  (opt) => !previousSelectedIds.includes(opt.id),
                )

                return (
                  <div key={target} className="space-y-2">
                    <Label>{label}</Label>
                    <Select
                      value={assignments[String(target)] ?? ''}
                      onValueChange={(value) =>
                        setAssignments((prev) => ({
                          ...prev,
                          [String(target)]: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'actionDialog.assign.assigneePlaceholder',
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {optionsForThisTarget.map((assignee) => (
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

        {mode === 'assignEditor' ? (
          <div className="space-y-2">
            <Label htmlFor="assign-editor">
              {t('actionDialog.assignEditor.assigneeLabel')}
            </Label>
            <Select
              value={selectedEditorId}
              onValueChange={setSelectedEditorId}
            >
              <SelectTrigger id="assign-editor">
                <SelectValue
                  placeholder={t(
                    'actionDialog.assignEditor.assigneePlaceholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {editors.map((editor) => (
                  <SelectItem key={editor.id} value={editor.id}>
                    {editor.name}
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
            disabled={
              isPending ||
              (mode === 'assign' &&
                assignmentTargets.some(
                  (target) => !assignments[String(target)],
                )) ||
              (mode === 'assignEditor' && !selectedEditorId)
            }
          >
            {t(`actionDialog.${mode}.submit` as const)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
