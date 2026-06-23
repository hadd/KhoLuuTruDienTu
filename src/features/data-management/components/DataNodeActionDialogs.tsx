import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ASSIGN_FOLDER_ROLE,
  EDITOR_USER_ROLE_IDS,
} from '@/features/data-management/lib/constants'
import {
  buildLevelUserIdsFromGroup,
} from '@/features/data-management/lib/checkerAssignmentHelpers'
import { GroupAssignPreview } from '@/features/group/components/GroupAssignPreview'
import { UserMultiSelectField } from '@/features/group/components/UserMultiSelectField'
import { MAX_APPROVAL_LEVELS } from '@/features/group/lib/groupPayload'

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
  adminGroupsQueryOptions,
  useAssignGroupByFolderMutation,
} from '@/features/group/queries'
import { buildAssignGroupByFolderPayload } from '@/features/group/lib/buildAssignGroupByFolderPayload'
import { buildQcAndAdminUsersList } from '@/features/group/lib/availableEditors'
import { adminUsersByRoleQueryOptions } from '@/features/user/queries'

const QC_ROLE_ID = 'qc'
const ADMIN_ROLE_ID = 'admin'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPermissionsByRole,
  type DataManagementRole,
} from '@/features/data-management/config/roleConfig'
import {
  useAddDataDocumentMutation,
  useAddDataFolderMutation,
  dataManagementTreeQueryKey,
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
  isDossierWorkflowNode,
  resolveAdminAssignFolderId,
  resolveDeleteTarget,
  resolveDossierEditorAssignId,
  resolveDossierUpdateId,
  type DataDeleteTargetT,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

export type DataNodeActionDialogMode =
  | 'rename'
  | 'delete'
  | 'addDocument'
  | 'addFolder'
  | 'assign'
  | 'assignEditor'
  | 'assignGroup'

type DeleteModeT = 'soft' | 'permanent'

export type DataNodeDeleteSuccessContextT = {
  deletedNodeId: string
  deleteTarget: DataDeleteTargetT
}

export function DataNodeActionDialogs({
  node,
  mode,
  onOpenChange,
  role,
  projectCode,
  tree,
  onEnsureNodeLoaded,
  onDeleteSuccess,
}: {
  node: DataTreeNodeT | null
  mode: DataNodeActionDialogMode | null
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
  projectCode?: string
  tree?: DataTreeNodeT | null
  onEnsureNodeLoaded?: (nodeId: string) => Promise<DataTreeNodeT | null>
  onDeleteSuccess?: (
    context: DataNodeDeleteSuccessContextT,
  ) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const permissions = getPermissionsByRole(role)
  const [name, setName] = useState('')
  const { data: groupsData } = useQuery({
    ...adminGroupsQueryOptions(),
    enabled: mode === 'assignGroup' || mode === 'assign',
  })
  const canFetchAssignees = mode === 'assign' && permissions.canAssign
  const { data: qcUsersData } = useQuery({
    ...adminUsersByRoleQueryOptions(QC_ROLE_ID),
    enabled: canFetchAssignees,
  })
  const { data: adminUsersData } = useQuery({
    ...adminUsersByRoleQueryOptions(ADMIN_ROLE_ID),
    enabled: canFetchAssignees,
  })
  const { data: editorUsersData } = useQuery({
    ...adminUsersByRoleQueryOptions('editor'),
    enabled: mode === 'assignEditor' && permissions.canAssignEditor,
  })
  const assigneeUsers = useMemo(() => {
    if (!qcUsersData && !adminUsersData) return []
    return buildQcAndAdminUsersList(
      qcUsersData?.items ?? [],
      adminUsersData?.items ?? [],
      null,
    )
  }, [qcUsersData, adminUsersData])
  const editors = useMemo(() => {
    if (!editorUsersData) return []
    return editorUsersData.items
      .filter((u) =>
        u.userRoles?.some((r) =>
          EDITOR_USER_ROLE_IDS.includes(
            r.roleId as (typeof EDITOR_USER_ROLE_IDS)[number],
          ),
        ),
      )
      .map((u) => ({ id: u.id, name: u.fullName }))
  }, [editorUsersData])
  const [assignmentCount, setAssignmentCount] = useState(1)
  const [assignmentCountInput, setAssignmentCountInput] = useState('1')
  const [assignments, setAssignments] = useState<Record<string, Array<string>>>(
    {},
  )
  const [selectedAssignGroupId, setSelectedAssignGroupId] = useState('')
  const [selectedEditorId, setSelectedEditorId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [dossiersPerEditor, setDossiersPerEditor] = useState(1)
  const [dossiersPerEditorInput, setDossiersPerEditorInput] = useState('1')
  const selectedGroup = useMemo(
    () => groupsData?.find((group) => group.id === selectedGroupId),
    [groupsData, selectedGroupId],
  )
  const selectedAssignGroup = useMemo(
    () => groupsData?.find((group) => group.id === selectedAssignGroupId),
    [groupsData, selectedAssignGroupId],
  )
  const isSelectedGroupConfigured = Boolean(selectedGroup?.metadataPermissionConfigId)
  const [deleteMode, setDeleteMode] = useState<DeleteModeT>('soft')
  const assignmentTargets = useMemo<Array<number>>(() => {
    const clamped = Math.min(
      Math.max(assignmentCount, 1),
      MAX_APPROVAL_LEVELS,
    )
    return Array.from({ length: clamped }, (_, index) => index + 1)
  }, [assignmentCount])
  const renameMutation = useRenameDataNodeMutation(role)
  const updateDossierMutation = useUpdateDossierMutation(role)
  const deleteMutation = useDeleteDataNodeMutation(role, projectCode)
  const addDocumentMutation = useAddDataDocumentMutation(role)
  const addFolderMutation = useAddDataFolderMutation(role)
  const assignMutation = useAssignDataRecordMutation(role)
  const assignEditorMutation = useAssignDossierEditorMutation(role)
  const assignGroupMutation = useAssignGroupByFolderMutation()
  const open = Boolean(node && mode)

  useEffect(() => {
    setName(node?.name ?? '')
  }, [node?.name])

  useEffect(() => {
    if (mode !== 'assign') return
    const count = Math.min(
      node?.requiredQcCount ?? 1,
      MAX_APPROVAL_LEVELS,
    )
    setAssignmentCount(count)
    setAssignmentCountInput(String(count))
    setSelectedAssignGroupId('')
  }, [mode, node?.id, node?.requiredQcCount])

  useEffect(() => {
    if (mode !== 'assign' || !selectedAssignGroup) return
    const round = Math.min(
      Math.max(selectedAssignGroup.roundNumber ?? 1, 1),
      MAX_APPROVAL_LEVELS,
    )
    setAssignmentCount(round)
    setAssignmentCountInput(String(round))
    setAssignments(
      Object.fromEntries(
        Object.entries(buildLevelUserIdsFromGroup(selectedAssignGroup)).map(
          ([level, userIds]) => [String(level), userIds],
        ),
      ),
    )
  }, [mode, selectedAssignGroup])

  useEffect(() => {
    if (mode !== 'assignEditor') return
    setSelectedEditorId(editors[0]?.id ?? '')
  }, [mode, editors])

  useEffect(() => {
    if (mode !== 'assignGroup') return
    setSelectedGroupId(groupsData?.[0]?.id ?? '')
    setDossiersPerEditor(1)
    setDossiersPerEditorInput('1')
  }, [mode, groupsData, node?.id])

  useEffect(() => {
    if (mode !== 'delete') return
    setDeleteMode('soft')
  }, [mode, node?.id])

  useEffect(() => {
    if (mode !== 'assign' || selectedAssignGroup) return
    setAssignments((prev) => {
      const next: Record<string, Array<string>> = {}
      for (const target of assignmentTargets) {
        const key = String(target)
        const prevValue = prev[key] ?? []
        const validIds = prevValue.filter((userId) =>
          assigneeUsers.some((user) => user.id === userId),
        )
        next[key] =
          validIds.length > 0
            ? validIds
            : assigneeUsers[0]
              ? [assigneeUsers[0].id]
              : []
      }
      return next
    })
  }, [assignmentTargets, assigneeUsers, mode, selectedAssignGroup])

  const handleToggleLevelUser = (level: number, userId: string) => {
    const key = String(level)
    setAssignments((prev) => {
      const current = prev[key] ?? []
      return {
        ...prev,
        [key]: current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      }
    })
  }

  if (!node || !mode) return null

  const deleteDescriptionKey =
    resolveDeleteTarget(node, tree)?.descriptionKey ??
    (node.type === 'folder' && !isDossierWorkflowNode(node)
      ? 'descriptionFolder'
      : 'descriptionDossier')

  const isPending =
    renameMutation.isPending ||
    deleteMutation.isPending ||
    addDocumentMutation.isPending ||
    addFolderMutation.isPending ||
    assignMutation.isPending ||
    assignEditorMutation.isPending ||
    assignGroupMutation.isPending ||
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
    if (currentMode === 'assignGroup')
      return t('actionDialog.assignGroup.success')
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
        let targetNode = node
        let deleteTarget = resolveDeleteTarget(node, tree)

        if (!deleteTarget && onEnsureNodeLoaded) {
          const loadedNode = await onEnsureNodeLoaded(node.id)
          if (loadedNode) {
            targetNode = loadedNode
            deleteTarget = resolveDeleteTarget(loadedNode, tree)
          }
        }

        if (!deleteTarget) {
          if (
            targetNode.type === 'folder' &&
            !isDossierWorkflowNode(targetNode)
          ) {
            deleteTarget = {
              target: 'folder',
              id: targetNode.folderId ?? targetNode.id,
              descriptionKey: 'descriptionFolder',
            }
          } else {
            const dossierId =
              findDescendantDossierTarget(targetNode)?.dossierId ??
              (await fetchDossierIdByFolderId(
                targetNode.folderId ?? targetNode.id,
              ))
            if (dossierId) {
              deleteTarget = {
                target: 'dossier',
                id: dossierId,
                descriptionKey: 'descriptionDossier',
              }
            }
          }
        }

        if (!deleteTarget) {
          toast.error(t('actionDialog.delete.noTarget'))
          return
        }

        await deleteMutation.mutateAsync({
          target: deleteTarget.target,
          id: deleteTarget.id,
          permanent: deleteMode === 'permanent',
        })
        await onDeleteSuccess?.({
          deletedNodeId: targetNode.id,
          deleteTarget,
        })
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
          const userIds = assignments[String(target)] ?? []
          for (const assigneeId of userIds) {
            await assignMutation.mutateAsync({
              folderId,
              assigneeId,
              role: ASSIGN_FOLDER_ROLE.checker(target),
            })
          }
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
      if (currentMode === 'assignGroup') {
        if (!selectedGroupId) {
          toast.error(t('actionDialog.assignGroup.noGroup'))
          return
        }
        const folderId = resolveAdminAssignFolderId(node)
        const result = await assignGroupMutation.mutateAsync({
          groupId: selectedGroupId,
          payload: buildAssignGroupByFolderPayload(
            [folderId],
            isSelectedGroupConfigured ? 1 : dossiersPerEditor,
          ),
        })
        await queryClient.invalidateQueries({
          queryKey: dataManagementTreeQueryKey(role),
        })
        toast.success(
          t('actionDialog.assignGroup.successSummary', {
            count: result.totalAssigned,
            groupName: result.group.name,
            checkerCount: result.checkerAssignmentsCreated,
          }),
        )
        close()
        return
      }
      toast.success(getSuccessMessage(currentMode))
      close()
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-md',
          (mode === 'assign' || mode === 'assignGroup') && 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>{t(`actionDialog.${mode}.title` as const)}</DialogTitle>
          <DialogDescription>
            {mode === 'delete'
              ? t(`actionDialog.delete.${deleteDescriptionKey}` as const)
              : t(`actionDialog.${mode}.description` as const)}
          </DialogDescription>
        </DialogHeader>

        {mode === 'delete' ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">
              {t('actionDialog.delete.modeLabel')}
            </legend>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label={t('actionDialog.delete.modeLabel')}
            >
              {(
                [
                  {
                    value: 'soft' as const,
                    label: t('actionDialog.delete.modeSoft'),
                  },
                  {
                    value: 'permanent' as const,
                    label: t('actionDialog.delete.modePermanent'),
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  htmlFor={`delete-mode-${option.value}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    deleteMode === option.value
                      ? 'border-primary bg-muted'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  <input
                    id={`delete-mode-${option.value}`}
                    type="radio"
                    name="delete-mode"
                    value={option.value}
                    checked={deleteMode === option.value}
                    onChange={() => setDeleteMode(option.value)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

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
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="assign-source-group">
                {t('actionDialog.assign.groupLabel')}
              </Label>
              <Select
                value={selectedAssignGroupId || '__none__'}
                onValueChange={(value) =>
                  setSelectedAssignGroupId(value === '__none__' ? '' : value)
                }
              >
                <SelectTrigger id="assign-source-group">
                  <SelectValue
                    placeholder={t('actionDialog.assign.groupPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t('actionDialog.assign.groupNone')}
                  </SelectItem>
                  {(groupsData ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAssignGroup ? (
              <GroupAssignPreview group={selectedAssignGroup} />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="assignment-count">
                {t('actionDialog.assign.countLabel')}
              </Label>
              <Input
                id="assignment-count"
                type="number"
                min={1}
                max={MAX_APPROVAL_LEVELS}
                value={assignmentCountInput}
                disabled={Boolean(selectedAssignGroup)}
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
                    setAssignmentCount(Math.min(parsed, MAX_APPROVAL_LEVELS))
                  }
                }}
                onBlur={() => {
                  if (assignmentCountInput === '') {
                    setAssignmentCount(1)
                    setAssignmentCountInput('1')
                    return
                  }
                  const parsed = Number(assignmentCountInput)
                  const next = Math.min(
                    Math.max(parsed, 1),
                    MAX_APPROVAL_LEVELS,
                  )
                  setAssignmentCount(next)
                  setAssignmentCountInput(String(next))
                }}
                placeholder={t('actionDialog.assign.countPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('actionDialog.assign.levelHint')}
              </p>
            </div>

            <div className="space-y-3">
              {assignmentTargets.map((target) => (
                <UserMultiSelectField
                  key={target}
                  label={t('actionDialog.assign.levelLabel', { level: target })}
                  placeholder={t('actionDialog.assign.assigneePlaceholder')}
                  selectedLabel={t('actionDialog.assign.selectedCount', {
                    count: (assignments[String(target)] ?? []).length,
                  })}
                  emptyLabel={t('actionDialog.assign.emptyAssignees')}
                  loadingLabel={t('actionDialog.assign.loadingAssignees')}
                  users={assigneeUsers}
                  isLoading={!qcUsersData && !adminUsersData}
                  selectedIds={assignments[String(target)] ?? []}
                  onToggle={(userId) => handleToggleLevelUser(target, userId)}
                  readOnly={Boolean(selectedAssignGroup)}
                />
              ))}
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

        {mode === 'assignGroup' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-group">
                {t('actionDialog.assignGroup.groupLabel')}
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger id="assign-group" className="w-full">
                  <SelectValue
                    placeholder={t('actionDialog.assignGroup.groupPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(groupsData ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGroup ? <GroupAssignPreview group={selectedGroup} /> : null}

            {!isSelectedGroupConfigured ? (
              <div className="space-y-2">
                <Label htmlFor="dossiers-per-editor">
                  {t('actionDialog.assignGroup.dossiersPerEditorLabel')}
                </Label>
                <Input
                  id="dossiers-per-editor"
                  type="number"
                  min={1}
                  step={1}
                  value={dossiersPerEditorInput}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === '') {
                      setDossiersPerEditorInput('')
                      return
                    }
                    if (!/^\d+$/.test(raw)) return
                    setDossiersPerEditorInput(raw)
                    const parsed = Number(raw)
                    if (parsed >= 1) {
                      setDossiersPerEditor(parsed)
                    }
                  }}
                  onBlur={() => {
                    if (dossiersPerEditorInput === '') {
                      setDossiersPerEditor(1)
                      setDossiersPerEditorInput('1')
                      return
                    }
                    const parsed = Number(dossiersPerEditorInput)
                    const next = Math.max(parsed, 1)
                    setDossiersPerEditor(next)
                    setDossiersPerEditorInput(String(next))
                  }}
                  placeholder={t(
                    'actionDialog.assignGroup.dossiersPerEditorPlaceholder',
                  )}
                />
              </div>
            ) : null}
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
                  (target) => (assignments[String(target)] ?? []).length === 0,
                )) ||
              (mode === 'assignEditor' && !selectedEditorId) ||
              (mode === 'assignGroup' &&
                (!selectedGroupId ||
                  (!isSelectedGroupConfigured && dossiersPerEditor < 1)))
            }
          >
            {t(`actionDialog.${mode}.submit` as const)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
