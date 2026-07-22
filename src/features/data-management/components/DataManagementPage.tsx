import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeftToLine,
  ArrowRightFromLine,
  FolderUp,
  PenLine,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  clearLoadedNodeCache,
  fetchDossierIdByFolderId,
  isNodeChildrenCached,
  removeNodeFromTree,
} from '@/features/data-management/api/dataManagementClient'
import type { UploadFolderResult } from '@/features/data-management/api/dossierClient'
import { DataFolderTree } from '@/features/data-management/components/DataFolderTree'
import type {
  DataNodeActionDialogMode,
  DataNodeDeleteSuccessContextT,
} from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeActionDialogs } from '@/features/data-management/components/DataNodeActionDialogs'
import { DataNodeContextMenu } from '@/features/data-management/components/DataNodeContextMenu'
import { DataNodeDetailModal } from '@/features/data-management/components/DataNodeDetailModal'
import { DataNodeDetailPanel } from '@/features/data-management/components/DataNodeDetailPanel'
import { DataTreeBreadcrumb } from '@/features/data-management/components/DataTreeBreadcrumb'
import { DigitizationSubPageShell } from '@/features/digitization/components/DigitizationSubPageShell'
import { DocumentUploadDialog } from '@/features/data-management/components/DocumentUploadDialog'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import { ExportChoiceDialog } from '@/features/data-management/components/ExportChoiceDialog'
import { FolderUploadDialog } from '@/features/data-management/components/FolderUploadDialog'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import {
  getPermissionsByRole,
  isProjectScopedDataRole,
  type DataManagementRole,
} from '@/features/data-management/config/roleConfig'
import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'
import type { OcrTerminalCompletePayloadT } from '@/features/data-management/hooks/useDataManagementOcrSocket'
import { useDataManagementOcrSocket } from '@/features/data-management/hooks/useDataManagementOcrSocket'
import { useDataManagementProjectSelection } from '@/features/data-management/hooks/useDataManagementProjectSelection'
import { resolveDossierNodeInTree } from '@/features/data-management/lib/dossierNavigation'
import { collectDossierIdsWithPendingIssueReports } from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  ExportContext,
  ExportMode,
} from '@/features/data-management/lib/exportHelpers'
import {
  resolveDossierIdForDip,
  resolveExportContext,
  runExport,
} from '@/features/data-management/lib/exportHelpers'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  collectOcrRoomIdsFromTree,
  filterTreeForSearch,
  findDescendantDossierTarget,
  findNodeByDossierId,
  findNodeById,
  findRecordParentForDocument,
  getPathToNode,
  isDossierWorkflowNode,
  isNodeForDossier,
  reloadTreePathToNode,
  resolveDataManagementSelection,
  resolveDocumentFocusNavigation,
  buildDefaultDataManagementNavigation,
  resolveDossierUpdateId,
  resolveFoldersToReloadAfterDelete,
  resolveRecordDossierId,
  resolveSelectionAfterDelete,
} from '@/features/data-management/lib/treeUtils'
import {
  discoverOcrWatchTargets,
  resolveFolderIdFromStorageKey,
} from '@/features/data-management/lib/uploadFolderResolve'
import {
  dataManagementProjectsQueryOptions,
  dataManagementTreeQueryKey,
  dataManagementTreeQueryOptions,
  syncQcIssueReportsFromTree,
  useClaimNextMakerAssignmentMutation,
  useLoadNodeChildrenMutation,
  useRefreshDataManagementTreeMutation,
} from '@/features/data-management/queries'
import type { DataManagementSearch } from '@/features/data-management/schemas'
import { adminProjectStore } from '@/features/data-management/store'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { editorDraftDossiersQueryKey } from '@/features/editor-dossiers/queries'
import { cn } from '@/lib/utils/cn'
import { BatchDigitalSignDrawer } from '@/features/digital-sign/components/BatchDigitalSignDrawer'
import { ArchiveSubmitDialog } from '@/features/archive-submission/components/ArchiveSubmitDialog'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'

function wrapDataDigitizationPage(content: ReactNode, className?: string) {
  return (
    <DigitizationSubPageShell active="data">
      <div
        className={cn(
          'flex h-0 min-h-0 flex-1 flex-col overflow-hidden',
          className,
        )}
      >
        {content}
      </div>
    </DigitizationSubPageShell>
  )
}

export interface DataManagementPageProps {
  role?: DataManagementRole
}

export function DataManagementPage({
  role = 'admin',
}: DataManagementPageProps) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const permissions = getPermissionsByRole(role)
  const { canSubmitArchive } = useArchiveSubmissionAccess()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadTargetFolder, setUploadTargetFolder] =
    useState<DataTreeNodeT | null>(null)
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false)
  const [uploadTargetRecord, setUploadTargetRecord] =
    useState<DataTreeNodeT | null>(null)
  const [actionState, setActionState] = useState<{
    node: DataTreeNodeT
    mode: DataNodeActionDialogMode
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    node: DataTreeNodeT
    x: number
    y: number
  } | null>(null)
  const [viewInfoNode, setViewInfoNode] = useState<DataTreeNodeT | null>(null)
  const [viewInfoOpen, setViewInfoOpen] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [ocrWatchFolderIds, setOcrWatchFolderIds] = useState<Array<string>>([])
  const [ocrWatchDossierIds, setOcrWatchDossierIds] = useState<Array<string>>(
    [],
  )
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportContext, setExportContext] = useState<ExportContext | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingMode, setExportingMode] = useState<ExportMode | null>(null)
  const [canExportDip, setCanExportDip] = useState(false)
  const [batchSignMode, setBatchSignMode] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState<Array<string>>([])
  const [batchSignDrawerOpen, setBatchSignDrawerOpen] = useState(false)
  const [archiveSubmitOpen, setArchiveSubmitOpen] = useState(false)
  const [archiveSubmitTarget, setArchiveSubmitTarget] = useState<{
    dossierId: string
    dossierName: string
  } | null>(null)
  const [treeExpandToNodeIds, setTreeExpandToNodeIds] = useState<Array<string>>(
    [],
  )
  const [isResolvingDossierDeepLink, setIsResolvingDossierDeepLink] =
    useState(false)
  const dossierDeepLinkSessionRef = useRef(0)

  const { projectCode, handleProjectChange, syncProjectFromNode } =
    useDataManagementProjectSelection()
  const isProjectScoped = isProjectScopedDataRole(role)
  const isAllProjects = projectCode === ALL_PROJECTS_CODE

  const q = typeof search.q === 'string' ? search.q : ''
  const dossierId =
    typeof search.dossierId === 'string' ? search.dossierId : undefined
  const nodeId = typeof search.nodeId === 'string' ? search.nodeId : undefined
  const focusDocumentId =
    typeof search.focusDocumentId === 'string'
      ? search.focusDocumentId
      : undefined
  const focusGroupIndex =
    typeof search.focusGroupIndex === 'number' &&
    Number.isFinite(search.focusGroupIndex)
      ? search.focusGroupIndex
      : undefined
  const isEditorDraftView = role === 'editor' && Boolean(dossierId?.trim())
  // Only editor scopes the tree query by dossierId (draft view). QC/admin use
  // dossierId purely as a one-shot deep-link param — putting it in the query key
  // breaks dossier focus (cache miss) and remounts the tree after clearing it.
  const treeQueryDossierId = isEditorDraftView ? dossierId : undefined

  const { data: projectsData, isPending: isProjectsPending } = useQuery({
    ...dataManagementProjectsQueryOptions(),
    enabled: isProjectScoped,
  })

  const {
    data: tree,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(
    dataManagementTreeQueryOptions(role, projectCode, treeQueryDossierId),
  )

  const pendingErrorReportDossierIds = useMemo(
    () => collectDossierIdsWithPendingIssueReports(tree, { role }),
    [tree, role],
  )

  useEffect(() => {
    if (role !== 'qc' || !tree) return
    syncQcIssueReportsFromTree(queryClient, tree)
  }, [role, tree, queryClient])

  const loadChildrenMutation = useLoadNodeChildrenMutation(role, projectCode)
  const loadChildrenMutationRef = useRef(loadChildrenMutation)
  loadChildrenMutationRef.current = loadChildrenMutation
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(
    role,
    projectCode,
  )
  const claimNextMutation = useClaimNextMakerAssignmentMutation()

  const needsProjectSelection = isProjectScoped && !projectCode?.trim()
  const containerClass = 'flex h-0 min-h-0 flex-1 flex-col overflow-hidden'
  const showSearch = true

  const selectedDossierIds = useMemo(() => {
    if (!tree) return [] as Array<string>
    return selectedRecordIds
      .map((id) => findNodeById(tree, id))
      .filter(
        (node): node is DataTreeNodeT =>
          Boolean(node) &&
          node.type === 'record' &&
          node.dossierStatus === 'APPROVED',
      )
      .map((node) => node.dossierId ?? node.id)
  }, [selectedRecordIds, tree])

  const handleOcrTerminalComplete = useCallback(
    (payload: OcrTerminalCompletePayloadT) => {
      setOcrWatchFolderIds((prev) =>
        prev.filter((folderId) => folderId !== payload.folderId),
      )
      setOcrWatchDossierIds((prev) =>
        prev.filter((id) => id !== payload.dossierId),
      )
    },
    [],
  )

  useEffect(() => {
    if (!tree) return

    const shouldDeferToDossierDeepLink =
      Boolean(dossierId?.trim()) && (isProjectScoped || role === 'qc')
    if (shouldDeferToDossierDeepLink) {
      return
    }

    const resolved = resolveDataManagementSelection(
      tree,
      { nodeId, focusDocumentId, focusGroupIndex },
      role,
      { isNodeChildrenCached },
    )

    if (!resolved.changed) return

    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: resolved.nodeId,
        focusDocumentId: resolved.focusDocumentId,
        focusGroupIndex: resolved.focusGroupIndex,
      }),
      replace: true,
    })
  }, [
    tree,
    nodeId,
    focusDocumentId,
    focusGroupIndex,
    navigate,
    role,
    isProjectScoped,
    dossierId,
  ])

  useEffect(() => {
    const supportsDossierDeepLink = isProjectScoped || role === 'qc'
    if (!supportsDossierDeepLink || !dossierId?.trim() || !tree) {
      return
    }

    const targetDossierId = dossierId.trim()
    const session = ++dossierDeepLinkSessionRef.current
    const isStale = () => session !== dossierDeepLinkSessionRef.current

    // Tree may be updated by mutations under the role/project key.
    const getCurrentTree = (): DataTreeNodeT | null =>
      queryClient.getQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role, projectCode, treeQueryDossierId),
      ) ??
      queryClient.getQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role, projectCode),
      ) ??
      null

    const initialTree = tree
    const currentNodeId =
      typeof search.nodeId === 'string' ? search.nodeId : undefined
    if (currentNodeId) {
      const currentNode = findNodeById(initialTree, currentNodeId)
      if (isNodeForDossier(currentNode, targetDossierId)) {
        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            dossierId: undefined,
          }),
          replace: true,
        })
        return
      }
    }

    async function loadNode(loadNodeId: string): Promise<DataTreeNodeT> {
      const result =
        await loadChildrenMutationRef.current.mutateAsync(loadNodeId)
      return result.tree
    }

    async function resolveDossierDeepLink() {
      setIsResolvingDossierDeepLink(true)

      try {
        let workingTree = getCurrentTree() ?? tree
        if (!workingTree || isStale()) return

        let resolvedNode = findNodeByDossierId(workingTree, targetDossierId)

        if (!resolvedNode) {
          const result = await resolveDossierNodeInTree(
            workingTree,
            targetDossierId,
            loadNode,
          )
          if (isStale()) return
          if (!result) {
            toast.error(t('errors.dossierDeepLinkNotFound'))
            void navigate({
              to: '.',
              search: (prev: DataManagementSearch) => ({
                ...prev,
                dossierId: undefined,
              }),
              replace: true,
            })
            return
          }

          workingTree = getCurrentTree() ?? result.tree
          resolvedNode =
            findNodeByDossierId(workingTree, targetDossierId) ?? result.node
        }

        try {
          if (
            resolvedNode.type === 'folder' &&
            isDossierWorkflowNode(resolvedNode)
          ) {
            await loadNode(resolvedNode.id)
            workingTree = getCurrentTree() ?? workingTree
            resolvedNode =
              findNodeById(workingTree, resolvedNode.id) ?? resolvedNode
          } else if (
            resolvedNode.type === 'record' &&
            !resolvedNode.dossierMetadata
          ) {
            await loadNode(resolvedNode.id)
            workingTree = getCurrentTree() ?? workingTree
            resolvedNode =
              findNodeById(workingTree, resolvedNode.id) ?? resolvedNode
          }
        } catch {
          if (isStale()) return
          toast.error(t('errors.loadFailed'))
          return
        }

        if (isStale()) return

        const path = getPathToNode(workingTree, resolvedNode.id)
        if (path.length > 0) {
          setTreeExpandToNodeIds(path.map((pathNode) => pathNode.id))
        }

        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            nodeId: resolvedNode.id,
            dossierId: undefined,
            focusDocumentId: undefined,
            focusGroupIndex: undefined,
          }),
          replace: true,
        })
      } finally {
        if (!isStale()) {
          setIsResolvingDossierDeepLink(false)
        }
      }
    }

    void resolveDossierDeepLink()

    return () => {
      dossierDeepLinkSessionRef.current += 1
      setIsResolvingDossierDeepLink(false)
    }
  }, [
    dossierId,
    isProjectScoped,
    navigate,
    projectCode,
    queryClient,
    role,
    search.nodeId,
    t,
    tree,
    treeQueryDossierId,
  ])

  useEffect(() => {
    if (!tree || !nodeId) return
    const node = findNodeById(tree, nodeId)
    if (!node) return

    const needsLoad =
      node.type === 'record'
        ? !node.dossierMetadata || node.children.length === 0
        : !isNodeChildrenCached(nodeId)

    if (!needsLoad) return
    loadChildrenMutation.mutate(nodeId)
  }, [tree, nodeId, role, loadChildrenMutation])

  function loadNodeTree(
    loadNodeId: string,
    options?: { refresh?: boolean },
  ): Promise<DataTreeNodeT> {
    const input = options?.refresh
      ? { nodeId: loadNodeId, refresh: true }
      : loadNodeId
    return loadChildrenMutation.mutateAsync(input).then((result) => result.tree)
  }

  function handleSearchInput(raw: string) {
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        q: raw.trim() ? raw : undefined,
      }),
      replace: true,
    })
  }

  const displayTree = useMemo(() => {
    if (!tree) return null
    return filterTreeForSearch(tree, q)
  }, [tree, q])

  const selectedNode = useMemo(() => {
    if (!tree || !nodeId) return null
    return findNodeById(tree, nodeId)
  }, [tree, nodeId])

  const detailContext = useMemo(() => {
    if (!tree || !selectedNode) return null

    if (selectedNode.type === 'document') {
      const parent = findRecordParentForDocument(tree, selectedNode.id)
      if (parent?.type === 'record') {
        return {
          node: parent,
          focusDocumentId: selectedNode.id,
          focusGroupIndex,
          dossierId: resolveRecordDossierId(parent),
          dossierStatus: parent.dossierStatus,
        }
      }
    }

    if (selectedNode.type === 'record') {
      return {
        node: selectedNode,
        focusDocumentId,
        focusGroupIndex,
        dossierId: resolveRecordDossierId(selectedNode),
        dossierStatus: selectedNode.dossierStatus,
      }
    }

    return {
      node: selectedNode,
      focusDocumentId: undefined,
      focusGroupIndex: undefined,
      dossierId: null,
      dossierStatus: undefined,
    }
  }, [tree, selectedNode, focusDocumentId, focusGroupIndex])

  useDataManagementOcrSocket({
    role,
    projectCode: isProjectScoped ? projectCode : undefined,
    tree,
    selectedNode: detailContext?.node ?? selectedNode,
    dossierId: detailContext?.dossierId,
    extraWatchFolderIds: ocrWatchFolderIds,
    extraWatchDossierIds: ocrWatchDossierIds,
    enabled: Boolean(tree) && !isError,
    onOcrTerminalComplete: handleOcrTerminalComplete,
  })

  async function reloadTreeAfterUpload(
    refreshNodeId?: string,
  ): Promise<DataTreeNodeT> {
    const freshTree = await refreshTreeMutation.mutateAsync(
      role === 'editor' ? dossierId : undefined,
    )

    const pathTargets = new Set<string>()
    const currentTargetId = focusDocumentId ?? nodeId
    if (currentTargetId) pathTargets.add(currentTargetId)
    if (refreshNodeId) pathTargets.add(refreshNodeId)

    let workingTree = freshTree
    for (const targetId of pathTargets) {
      if (!findNodeById(workingTree, targetId)) continue
      workingTree = await reloadTreePathToNode(workingTree, targetId, (id) =>
        loadNodeTree(id),
      )
    }

    if (refreshNodeId && findNodeById(workingTree, refreshNodeId)) {
      workingTree = await loadNodeTree(refreshNodeId, { refresh: true })
    }

    if (pathTargets.size > 0) {
      setTreeExpandToNodeIds([...pathTargets])
    }

    return workingTree
  }

  async function handleUploadPostProcess(
    result: UploadFolderResult,
    refreshNodeId?: string,
  ) {
    try {
      const workingTree = await reloadTreeAfterUpload(refreshNodeId)

      if (role !== 'admin') return

      const folderIds = new Set<string>()
      const dossierIds = new Set<string>()

      for (const item of result.results) {
        if (item.status !== 'uploaded' && item.status !== 'skipped') continue
        if (item.folderId) folderIds.add(item.folderId)
        if (item.dossierId) dossierIds.add(item.dossierId)
      }

      const sample = result.results.find(
        (item) =>
          (item.status === 'uploaded' || item.status === 'skipped') &&
          item.storageKey,
      )

      async function tryResolveFolderIds(treeToSearch: DataTreeNodeT) {
        if (folderIds.size > 0 || !sample?.storageKey) return

        const resolved = await resolveFolderIdFromStorageKey(
          treeToSearch,
          sample.storageKey,
          loadNodeTree,
        )
        if (!resolved) return

        folderIds.add(resolved.folderId)
      }

      await tryResolveFolderIds(workingTree)

      const discovered = await discoverOcrWatchTargets(
        workingTree,
        loadNodeTree,
        folderIds.size > 0 ? [...folderIds] : undefined,
      )
      for (const folderId of discovered.folderIds) folderIds.add(folderId)
      for (const dossierId of discovered.dossierIds) dossierIds.add(dossierId)

      if (folderIds.size > 0) {
        setOcrWatchFolderIds((prev) => [...new Set([...prev, ...folderIds])])
      }
      if (dossierIds.size > 0) {
        setOcrWatchDossierIds((prev) => [...new Set([...prev, ...dossierIds])])
      }
    } catch {
      toast.error(t('upload.postProcessFailed'))
    }
  }

  async function handleUploadSuccess(result: UploadFolderResult) {
    await handleUploadPostProcess(result, uploadTargetFolder?.id)
  }

  async function handleDocumentUploadSuccess(result: UploadFolderResult) {
    await handleUploadPostProcess(result, uploadTargetRecord?.id)
  }

  function handleExportExcel(node: DataTreeNodeT) {
    const ctx = resolveExportContext(node)
    if (!ctx) return

    setExportContext(ctx)
    setCanExportDip(Boolean(ctx.dossierId))
    setExportDialogOpen(true)

    if (!ctx.dossierId && ctx.kind === 'folder' && ctx.folderId) {
      void resolveDossierIdForDip(ctx).then((dossierId) => {
        if (dossierId) {
          setCanExportDip(true)
          setExportContext((prev) => (prev ? { ...prev, dossierId } : prev))
        }
      })
    }
  }

  async function handleSubmitArchive(node: DataTreeNodeT) {
    let dossierId = resolveDossierUpdateId(node)
    if (!dossierId) {
      dossierId =
        findDescendantDossierTarget(node)?.dossierId ??
        (await fetchDossierIdByFolderId(node.folderId ?? node.id))
    }
    if (!dossierId) {
      toast.error(t('errors.dossierNotFound'))
      return
    }

    setArchiveSubmitTarget({
      dossierId,
      dossierName: node.name,
    })
    setArchiveSubmitOpen(true)
  }

  const handleExport = useCallback(
    async (mode: ExportMode, options?: { presetId?: string }) => {
      if (!exportContext || isExporting) return

      setIsExporting(true)
      setExportingMode(mode)
      try {
        let dossierId = exportContext.dossierId
        if (mode === 'dip' && !dossierId) {
          dossierId = await resolveDossierIdForDip(exportContext)
        }
        await runExport({
          kind: exportContext.kind,
          mode,
          folderId: exportContext.folderId,
          dossierId,
          downloadName: exportContext.downloadName,
          metadataExportConfig: options?.presetId
            ? { presetId: options.presetId }
            : undefined,
        })
        toast.success(t('recordDetail.exportExcelSuccess'))
        setExportDialogOpen(false)
      } catch {
        toast.error(t('recordDetail.exportExcelError'))
      } finally {
        setIsExporting(false)
        setExportingMode(null)
      }
    },
    [exportContext, isExporting, t],
  )

  function handleFocusDocument(documentId: string, groupIndex: number) {
    if (!tree || !nodeId) return
    const recordNode = findNodeById(tree, nodeId)
    if (recordNode?.type !== 'record') return
    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: recordNode.id,
        focusDocumentId: documentId,
        focusGroupIndex: groupIndex,
      }),
    })
  }

  function navigateToNode(id: string, treeOverride?: DataTreeNodeT) {
    const activeTree = treeOverride ?? tree

    if (!activeTree) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: id,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
      return
    }

    const targetNode = findNodeById(activeTree, id)
    if (targetNode?.type === 'document') {
      const focus = resolveDocumentFocusNavigation(activeTree, id, {
        nodeId,
        focusDocumentId,
        focusGroupIndex,
      })
      if (focus) {
        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            ...focus,
          }),
        })
        return
      }
    }

    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: id,
        focusDocumentId: undefined,
        focusGroupIndex: undefined,
      }),
    })
  }

  async function handleSelectNode(id: string) {
    let workingTree = tree

    try {
      if (workingTree) {
        const targetNode = findNodeById(workingTree, id)

        if (
          batchSignMode &&
          targetNode?.type === 'record' &&
          targetNode.dossierStatus === 'APPROVED'
        ) {
          setSelectedRecordIds((prev) =>
            prev.includes(id)
              ? prev.filter((recordId) => recordId !== id)
              : [...prev, id],
          )
          return
        }

        if (
          isProjectScoped &&
          !isAllProjects &&
          targetNode?.projectCode?.trim() &&
          targetNode.projectCode !== projectCode
        ) {
          syncProjectFromNode(targetNode.projectCode, id)
          return
        }

        if (targetNode?.type === 'document') {
          const parent = findRecordParentForDocument(workingTree, id)
          const loadId = parent?.id ?? targetNode.parentId
          if (loadId) {
            const parentNode =
              parent ?? findNodeById(workingTree, loadId) ?? null
            if (
              !parentNode ||
              parentNode.type !== 'record' ||
              !parentNode.dossierMetadata
            ) {
              workingTree = await loadNodeTree(loadId)
            }
          }
        } else if (targetNode?.type === 'folder' && isProjectScoped) {
          const isStaleDossierFolder =
            isDossierWorkflowNode(targetNode) &&
            targetNode.children.length === 0 &&
            isNodeChildrenCached(id)

          if (isStaleDossierFolder || !isNodeChildrenCached(id)) {
            workingTree = await loadNodeTree(
              id,
              isStaleDossierFolder ? { refresh: true } : undefined,
            )
          }
        } else if (
          targetNode?.type === 'record' &&
          (!isNodeChildrenCached(id) || !targetNode.dossierMetadata)
        ) {
          loadChildrenMutation.mutate(id)
        } else if (!isNodeChildrenCached(id)) {
          loadChildrenMutation.mutate(id)
        }
      }
    } catch {
      toast.error(t('errors.loadFailed'))
      return
    }

    navigateToNode(id, workingTree ?? undefined)
  }

  async function handleDeleteSuccess({
    deletedNodeId,
  }: DataNodeDeleteSuccessContextT) {
    const currentTree = queryClient.getQueryData<DataTreeNodeT>(
      dataManagementTreeQueryKey(role, projectCode),
    )
    if (!currentTree) return

    const reloadFolderIds = resolveFoldersToReloadAfterDelete(
      currentTree,
      deletedNodeId,
    )
    const nextNodeId = resolveSelectionAfterDelete(
      currentTree,
      deletedNodeId,
      nodeId,
    )

    const optimisticTree = removeNodeFromTree(deletedNodeId)
    if (optimisticTree) {
      queryClient.setQueryData(
        dataManagementTreeQueryKey(role, projectCode),
        optimisticTree,
      )
    }

    clearLoadedNodeCache(deletedNodeId)

    for (const folderId of reloadFolderIds) {
      clearLoadedNodeCache(folderId)
      try {
        await loadNodeTree(folderId, { refresh: true })
      } catch {
        toast.error(t('errors.loadFailed'))
      }
    }

    if (nextNodeId) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: nextNodeId,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
    }
  }

  async function clearDataManagementSelectionInUrl() {
    await navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: undefined,
        focusDocumentId: undefined,
        focusGroupIndex: undefined,
      }),
      replace: true,
    })
  }

  async function navigateToDefaultDataManagementSelection(
    nextTree: DataTreeNodeT,
  ) {
    const navigation = buildDefaultDataManagementNavigation(nextTree, role)
    await navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: navigation.nodeId,
        focusDocumentId: navigation.focusDocumentId,
        focusGroupIndex: navigation.focusGroupIndex,
      }),
      replace: true,
    })
  }

  async function handleEditorClaimNext(options?: { clearUrlFirst?: boolean }) {
    if (options?.clearUrlFirst) {
      await clearDataManagementSelectionInUrl()
    }
    const nextTree = await claimNextMutation.mutateAsync()
    await navigateToDefaultDataManagementSelection(nextTree)
  }

  async function handleMetadataReload(
    reloadDossierId: string,
    mode: 'draft' | 'final' | 'error_report' = 'draft',
  ) {
    try {
      if (role === 'editor') {
        await queryClient.invalidateQueries({
          queryKey: editorDraftDossiersQueryKey,
        })

        if (mode === 'final') {
          if (dossierId) {
            void navigate({
              to: '/app/dossiers',
              search: {},
            })
            return
          }

          await handleEditorClaimNext({ clearUrlFirst: true })
          return
        }

        if (mode === 'error_report') {
          await handleEditorClaimNext({ clearUrlFirst: true })
          return
        }

        if (dossierId) {
          await refreshTreeMutation.mutateAsync(reloadDossierId)
          return
        }

        // mode === 'draft' — refresh hồ sơ hiện tại, giữ selection URL
        const targetNodeId = focusDocumentId ?? nodeId
        const freshTree = await refreshTreeMutation.mutateAsync(reloadDossierId)
        if (targetNodeId && findNodeById(freshTree, targetNodeId)) {
          await reloadTreePathToNode(freshTree, targetNodeId, loadNodeTree)
        }
        return
      }

      const targetNodeId = focusDocumentId ?? nodeId
      const freshTree = await refreshTreeMutation.mutateAsync(undefined)
      if (targetNodeId) {
        await reloadTreePathToNode(freshTree, targetNodeId, loadNodeTree)
      }
    } catch (reloadError) {
      if (role === 'editor' && isNoAssignedDossierError(reloadError)) {
        toast.info(t('errors.noAssignedDossier'))
        return
      }
      toast.error(t('errors.loadFailed'))
      throw new Error('metadata reload failed')
    }
  }

  if (isError) {
    if (role === 'editor' && isNoAssignedDossierError(error)) {
      return wrapDataDigitizationPage(<EditorNoAssignmentState />)
    }

    return wrapDataDigitizationPage(
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isProjectScoped) {
              adminProjectStore.clearProjectCode()
              void navigate({ to: '/app/data', search: {} })
              return
            }
            void refetch()
          }}
          disabled={!isProjectScoped && isRefetching}
        >
          {tCommon('errors.tryAgain')}
        </Button>
      </div>,
    )
  }

  if (isProjectScoped && isProjectsPending) {
    return wrapDataDigitizationPage(
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>,
    )
  }

  if (
    isProjectScoped &&
    !isAllProjects &&
    !isProjectsPending &&
    (projectsData?.items.length ?? 0) === 0
  ) {
    return wrapDataDigitizationPage(
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('project.empty')}
        </p>
      </div>,
    )
  }

  if (needsProjectSelection) {
    return wrapDataDigitizationPage(
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
        <p className="text-center text-sm text-muted-foreground">
          {t('project.selectPrompt')}
        </p>
        <ProjectSelect
          className="w-full max-w-sm"
          value={projectCode}
          onValueChange={handleProjectChange}
        />
      </div>,
    )
  }

  if (isPending) {
    return wrapDataDigitizationPage(
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>,
    )
  }

  const content = (
    <>
      <div className="relative flex h-0 min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border">
        {isResolvingDossierDeepLink ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
            <p className="text-sm text-muted-foreground">
              {t('dossierDeepLink.resolving')}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setTreeCollapsed((prev) => !prev)}
          aria-label={treeCollapsed ? t('tree.expand') : t('tree.collapse')}
          className={cn(
            'absolute top-3 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-[left,transform] duration-300 ease-in-out hover:bg-accent hover:text-foreground',
            treeCollapsed ? 'left-3' : 'left-72 -translate-x-1/2',
          )}
        >
          {treeCollapsed ? (
            <ArrowRightFromLine className="size-3.5" />
          ) : (
            <ArrowLeftToLine className="size-3.5" />
          )}
        </button>
        <div
          className={cn(
            'flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width,opacity] duration-300 ease-in-out',
            treeCollapsed
              ? 'w-0 min-w-0 opacity-0'
              : 'w-72 min-w-[18rem] opacity-100',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              treeCollapsed && 'pointer-events-none',
            )}
          >
            {showSearch || isProjectScoped ? (
              <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
                {isProjectScoped ? (
                  <ProjectSelect
                    className="w-full"
                    value={projectCode}
                    onValueChange={handleProjectChange}
                  />
                ) : null}
                {showSearch ? (
                  <Input
                    className="border-input bg-background"
                    placeholder={t('search.placeholder')}
                    value={q}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    aria-label={t('search.placeholder')}
                  />
                ) : null}
              </div>
            ) : null}
            {displayTree ? (
              <DataFolderTree
                tree={displayTree}
                selectedId={focusDocumentId ?? nodeId}
                expandPathToNodeIds={treeExpandToNodeIds}
                onExpandPathApplied={() => setTreeExpandToNodeIds([])}
                pendingErrorReportDossierIds={pendingErrorReportDossierIds}
                onSelect={(id) => {
                  void handleSelectNode(id)
                }}
                onContextMenuNode={
                  permissions.canContextMenu
                    ? (node, x, y) => setContextMenu({ node, x, y })
                    : undefined
                }
                onExpandNode={(id) => {
                  void loadNodeTree(id).then((updatedTree) => {
                    const { folderIds, dossierIds } =
                      collectOcrRoomIdsFromTree(updatedTree)

                    if (folderIds.length > 0) {
                      setOcrWatchFolderIds((prev) => [
                        ...new Set([...prev, ...folderIds]),
                      ])
                    }
                    if (dossierIds.length > 0) {
                      setOcrWatchDossierIds((prev) => [
                        ...new Set([...prev, ...dossierIds]),
                      ])
                    }
                  })
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
            <div
              className={cn('min-w-0 flex-1', treeCollapsed ? 'pl-8' : 'pl-5')}
            >
              <DataTreeBreadcrumb tree={tree} nodeId={nodeId} role={role} />
            </div>
            {permissions.canDigitalSign ? (
              <>
                <Button
                  type="button"
                  variant={batchSignMode ? 'secondary' : 'outline'}
                  className="shrink-0 gap-2"
                  onClick={() => {
                    setBatchSignMode((prev) => {
                      const next = !prev
                      if (!next) {
                        setSelectedRecordIds([])
                      }
                      return next
                    })
                  }}
                >
                  <PenLine className="size-4" aria-hidden />
                  {batchSignMode
                    ? t('digitalSign.exitBatchMode')
                    : t('digitalSign.batchMode')}
                </Button>
                {batchSignMode ? (
                  <Button
                    type="button"
                    className="shrink-0 gap-2"
                    disabled={selectedDossierIds.length === 0}
                    onClick={() => setBatchSignDrawerOpen(true)}
                  >
                    <PenLine className="size-4" aria-hidden />
                    {t('digitalSign.batchAction', {
                      count: selectedDossierIds.length,
                    })}
                  </Button>
                ) : null}
              </>
            ) : null}
            {permissions.canUpload && (
              <Button
                type="button"
                variant="default"
                className="shrink-0 gap-2"
                onClick={() => {
                  setUploadTargetFolder(null)
                  setUploadOpen(true)
                }}
              >
                <FolderUp className="size-4" aria-hidden />
                {t('actions.uploadFolder')}
              </Button>
            )}
          </div>
          <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden p-2">
            <DataNodeDetailPanel
              node={detailContext?.node ?? null}
              role={role}
              dossierId={detailContext?.dossierId}
              dossierStatus={detailContext?.dossierStatus}
              isEditorDraftView={isEditorDraftView}
              focusDocumentId={detailContext?.focusDocumentId}
              focusGroupIndex={detailContext?.focusGroupIndex}
              onFocusDocument={handleFocusDocument}
              onSelectNode={(id) => {
                void handleSelectNode(id)
              }}
              onWorkflowComplete={handleMetadataReload}
            />
          </div>
        </div>
      </div>

      <FolderUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) setUploadTargetFolder(null)
        }}
        role={role}
        projectCode={projectCode}
        targetFolder={uploadTargetFolder}
        onUploadSuccess={handleUploadSuccess}
      />
      <DocumentUploadDialog
        open={documentUploadOpen}
        onOpenChange={(open) => {
          setDocumentUploadOpen(open)
          if (!open) setUploadTargetRecord(null)
        }}
        role={role}
        projectCode={projectCode}
        targetRecord={uploadTargetRecord}
        onUploadSuccess={handleDocumentUploadSuccess}
      />
      <DataNodeActionDialogs
        node={actionState?.node ?? null}
        mode={actionState?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setActionState(null)
        }}
        role={role}
        projectCode={projectCode}
        tree={tree}
        onEnsureNodeLoaded={async (id) => {
          const updatedTree = await loadNodeTree(id)
          return findNodeById(updatedTree, id)
        }}
        onDeleteSuccess={handleDeleteSuccess}
      />
      <DataNodeContextMenu
        node={contextMenu?.node ?? null}
        open={!!contextMenu}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onAction={(node, mode) => setActionState({ node, mode })}
        onViewInfo={(node) => {
          setViewInfoNode(node)
          setViewInfoOpen(true)
        }}
        onExportExcel={(node) => void handleExportExcel(node)}
        onUploadDossier={(node) => {
          setUploadTargetFolder(node)
          setUploadOpen(true)
        }}
        onUploadDocument={(node) => {
          setUploadTargetRecord(node)
          setDocumentUploadOpen(true)
        }}
        onSubmitArchive={(node) => {
          void handleSubmitArchive(node)
        }}
        onClose={() => setContextMenu(null)}
        role={role}
        permissions={permissions}
        canSubmitArchive={canSubmitArchive}
      />
      <ArchiveSubmitDialog
        open={archiveSubmitOpen}
        onOpenChange={(open) => {
          setArchiveSubmitOpen(open)
          if (!open) setArchiveSubmitTarget(null)
        }}
        dossierId={archiveSubmitTarget?.dossierId ?? null}
        dossierName={archiveSubmitTarget?.dossierName}
        onSuccess={() => {
          void refetch()
        }}
      />
      <DataNodeDetailModal
        node={viewInfoNode}
        open={viewInfoOpen}
        onOpenChange={(open) => {
          setViewInfoOpen(open)
          if (!open) setViewInfoNode(null)
        }}
      />
      <ExportChoiceDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        context={exportContext}
        canExportDip={canExportDip}
        onExport={handleExport}
        isExporting={isExporting}
        exportingMode={exportingMode}
      />
      <BatchDigitalSignDrawer
        open={batchSignDrawerOpen}
        onOpenChange={setBatchSignDrawerOpen}
        dossierIds={selectedDossierIds}
        onCompleted={() => {
          void refetch()
          setSelectedRecordIds([])
          setBatchSignMode(false)
        }}
      />
    </>
  )

  return wrapDataDigitizationPage(<div className={containerClass}>{content}</div>)
}
