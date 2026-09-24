import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeftToLine,
  ArrowRightFromLine,
  FolderUp,
  Loader2,
  PenLine,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  clearLoadedNodeCache,
  fetchDossierIdByFolderId,
  getSearchTree,
  isNodeChildrenCached,
  removeNodeFromTree,
} from '@/features/data-management/api/dataManagementClient'
import type { UploadFolderResult } from '@/features/data-management/api/dossierClient'
import { AssignPdfDocumentDialog } from '@/features/data-management/components/AssignPdfDocumentDialog'
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
  isProjectScopedDataRole,
  type DataManagementRole,
} from '@/features/data-management/config/roleConfig'
import { useDataManagementResolvedPermissions } from '@/features/data-management/hooks/useDataManagementRole'
import {
  ALL_PROJECTS_CODE,
  DATA_TREE_ROOT_ID,
} from '@/features/data-management/lib/constants'
import type { OcrTerminalCompletePayloadT } from '@/features/data-management/hooks/useDataManagementOcrSocket'
import { useDataManagementOcrSocket } from '@/features/data-management/hooks/useDataManagementOcrSocket'
import { useDataManagementProjectSelection } from '@/features/data-management/hooks/useDataManagementProjectSelection'
import { resolveDossierNodeInTree } from '@/features/data-management/lib/dossierNavigation'
import {
  loadCompletedDocumentIds,
  saveCompletedDocumentIds,
} from '@/features/data-management/lib/documentEditProgress'
import { collectDossierIdsWithPendingIssueReports } from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  ExportContext,
  ExportMode,
  ExportOptions,
} from '@/features/data-management/lib/exportHelpers'
import {
  resolveDossierIdForDip,
  resolveExportContext,
  runExport,
} from '@/features/data-management/lib/exportHelpers'
import {
  canExportAnyStatusPermission,
  canExportDossiersPermission,
} from '@/features/data-management/lib/dossierExportAccess'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  collectOcrRoomIdsFromTree,
  filterTreeExcludeArchived,
  filterTreeForSearch,
  findDescendantDossierTarget,
  findNodeByDossierId,
  findNodeById,
  findRecordParentForDocument,
  getBatchExportCheckState,
  getPathToNode,
  matchesFuzzyFileName,
  isBatchSignSelectableNode,
  isBatchExportDossierLeafNode,
  isBatchExportSelectableNode,
  isUnderSelectedBatchExportFolder,
  isDossierWorkflowNode,
  isNodeForDossier,
  isNodeUnderAncestor,
  reloadTreePathToNode,
  resolveDataManagementSelection,
  resolveDocumentFocusNavigation,
  buildDefaultDataManagementNavigation,
  resolveDossierUpdateId,
  resolveFolderExportId,
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
  useRefreshDossierContentMutation,
} from '@/features/data-management/queries'
import type { DataManagementSearch } from '@/features/data-management/schemas'
import { adminProjectStore } from '@/features/data-management/store'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { editorDraftDossiersQueryKey } from '@/features/editor-dossiers/queries'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'
import { BatchDigitalSignDrawer } from '@/features/digital-sign/components/BatchDigitalSignDrawer'
import {
  ensureSignAgentReady,
  SIGN_AGENT_DOWNLOAD_URL,
} from '@/features/digital-sign/lib/ensureSignAgentReady'
import { ArchiveSubmitDialog } from '@/features/archive-submission/components/ArchiveSubmitDialog'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useRoleAccess } from '@/features/permissions/hooks/useRoleAccess'

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
  const permissions = useDataManagementResolvedPermissions()
  const { permissions: userPermissions } = useRoleAccess()
  const canExportDossiers = canExportDossiersPermission(userPermissions)
  const exportStatusOptions = useMemo(
    () => ({
      bypassStatus: canExportAnyStatusPermission(userPermissions),
    }),
    [userPermissions],
  )
  const { canSubmitArchive } = useArchiveSubmissionAccess()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadTargetFolder, setUploadTargetFolder] =
    useState<DataTreeNodeT | null>(null)
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false)
  const [uploadTargetRecord, setUploadTargetRecord] =
    useState<DataTreeNodeT | null>(null)
  const [assignPdfOpen, setAssignPdfOpen] = useState(false)
  const [assignPdfTargetNode, setAssignPdfTargetNode] =
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
  const [batchExportMode, setBatchExportMode] = useState(false)
  const [batchExportDialogOpen, setBatchExportDialogOpen] = useState(false)
  const [batchExportingMode, setBatchExportingMode] = useState<ExportMode | null>(null)
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
  const [localSearchQuery, setLocalSearchQuery] = useState(q)

  useEffect(() => {
    setLocalSearchQuery(q)
  }, [q])
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
  const focusFieldKey =
    typeof search.focusFieldKey === 'string' && search.focusFieldKey.trim()
      ? search.focusFieldKey.trim()
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
    data: baseTree,
    isPending: isBasePending,
    isError: isBaseError,
    error: baseError,
    refetch,
    isRefetching,
  } = useQuery(
    dataManagementTreeQueryOptions(role, projectCode, treeQueryDossierId),
  )

  const {
    data: searchTree,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
  } = useQuery({
    queryKey: ['data-management', 'search-tree', role, projectCode, q] as const,
    queryFn: () => getSearchTree(role, { projectCode, q }),
    staleTime: 30_000,
    enabled: Boolean(q.trim()) && (!isProjectScopedDataRole(role) || Boolean(projectCode?.trim())),
  })

  const isSearching = Boolean(q.trim())

  const tree = isSearching
    ? (searchTree ?? null)
    : baseTree

  const isPending = isSearching ? isSearchPending || isBasePending : isBasePending
  const isError = isSearching ? isSearchError : isBaseError
  const error = isSearching ? searchError : baseError

  const displayTree = useMemo(() => {
    if (!tree) return null

    if (isSearching) {
      if (!searchTree) return null
      // Search returned 0 results: do NOT merge baseTree, keep search result completely empty
      if (searchTree.children.length === 0) {
        return { ...searchTree, children: [] }
      }

      let currentTree = searchTree
      if (baseTree) {
        function mergeChildren(node: DataTreeNodeT, bt: DataTreeNodeT): DataTreeNodeT {
          const mergedNode = { ...node }
          // Never merge baseTree into root:
          if (mergedNode.id === DATA_TREE_ROOT_ID) {
            mergedNode.children = mergedNode.children.map((child) =>
              mergeChildren(child, bt),
            )
            return mergedNode
          }

          const baseNode = findNodeById(bt, mergedNode.id)
          if (baseNode) {
            if (mergedNode.children.length === 0 && baseNode.children.length > 0) {
              mergedNode.children = baseNode.children
            } else if (mergedNode.children.length > 0) {
              mergedNode.children = mergedNode.children.map((child) =>
                mergeChildren(child, bt),
              )
            }

            if (baseNode.dossierMetadata && !mergedNode.dossierMetadata) {
              mergedNode.dossierMetadata = baseNode.dossierMetadata
            }
            if (mergedNode.type === 'record') {
              mergedNode.fileCount = baseNode.fileCount || mergedNode.fileCount
              mergedNode.pageCount = baseNode.pageCount || mergedNode.pageCount
              mergedNode.sizeBytes = baseNode.sizeBytes || mergedNode.sizeBytes
              mergedNode.dossierStatus = baseNode.dossierStatus || mergedNode.dossierStatus
            }
          } else if (mergedNode.children.length > 0) {
            mergedNode.children = mergedNode.children.map((child) =>
              mergeChildren(child, bt),
            )
          }

          return mergedNode
        }
        currentTree = mergeChildren(currentTree, baseTree)
      }

      return filterTreeExcludeArchived(currentTree)
    }

    const afterArchived = filterTreeExcludeArchived(tree)
    return filterTreeForSearch(afterArchived, q)
  }, [tree, q, isSearching, baseTree, searchTree])

  const isSearchEmpty =
    isSearching &&
    !isSearchPending &&
    !isSearchError &&
    displayTree !== null &&
    displayTree.children.length === 0

  const effectiveTree = displayTree ?? tree

  const pendingErrorReportDossierIds = useMemo(
    () => collectDossierIdsWithPendingIssueReports(effectiveTree, { role }),
    [effectiveTree, role],
  )

  useEffect(() => {
    if (role !== 'qc' || !effectiveTree) return
    syncQcIssueReportsFromTree(queryClient, effectiveTree)
  }, [role, effectiveTree, queryClient])

  const loadChildrenMutation = useLoadNodeChildrenMutation(role, projectCode)
  const loadChildrenMutationRef = useRef(loadChildrenMutation)
  loadChildrenMutationRef.current = loadChildrenMutation
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(
    role,
    projectCode,
  )
  const refreshDossierContentMutation = useRefreshDossierContentMutation(
    role,
    projectCode,
  )
  // Ký số xong: chỉ patch riêng nội dung hồ sơ đó (file list + isSigned) —
  // nhanh và luôn trúng đúng node đang mở, khác với handleMetadataReload
  // (rebuild toàn cây từ gốc, có thể làm mất nhánh đã mở sâu và không tự
  // load lại record đang xem → chữ ký không hiện cho tới khi F5 trang).
  const handleDigitalSignCompleted = useCallback(
    (signedDossierId: string) => {
      void refreshDossierContentMutation
        .mutateAsync(signedDossierId)
        .catch(() => null)
    },
    [refreshDossierContentMutation],
  )
  const claimNextMutation = useClaimNextMakerAssignmentMutation()

  const needsProjectSelection =
    isProjectScoped && permissions.canReadProjects && !projectCode?.trim()
  const containerClass = 'flex h-0 min-h-0 flex-1 flex-col overflow-hidden'
  const showSearch = true

  const selectedDossierIds = useMemo(() => {
    if (!effectiveTree) return [] as Array<string>
    const ids = selectedRecordIds
      .map((id) => findNodeById(effectiveTree, id))
      .filter((node): node is DataTreeNodeT => {
        if (!node) return false
        if (batchSignMode) return isBatchSignSelectableNode(node)
        if (batchExportMode)
          return isBatchExportDossierLeafNode(node, exportStatusOptions)
        return false
      })
      .filter((node) => {
        if (!batchExportMode || !effectiveTree) return true
        // Covered by a selected ancestor folder — folder API exports the subtree.
        return !isUnderSelectedBatchExportFolder(
          node,
          effectiveTree,
          selectedRecordIds,
          exportStatusOptions,
        )
      })
      .map((node) => node.dossierId ?? node.id)
    return [...new Set(ids)]
  }, [
    selectedRecordIds,
    effectiveTree,
    batchSignMode,
    batchExportMode,
    exportStatusOptions,
  ])

  const selectedExportFolderIds = useMemo(() => {
    if (!effectiveTree || !batchExportMode) return [] as Array<string>
    const ids = selectedRecordIds
      .map((id) => findNodeById(effectiveTree, id))
      .filter((node): node is DataTreeNodeT => {
        if (!node) return false
        if (isBatchExportDossierLeafNode(node, exportStatusOptions)) return false
        if (
          node.type !== 'folder' ||
          !isBatchExportSelectableNode(node, exportStatusOptions)
        ) {
          return false
        }
        // Covered by a selected ancestor folder — one folderId API call is enough.
        return !isUnderSelectedBatchExportFolder(
          node,
          effectiveTree,
          selectedRecordIds,
          exportStatusOptions,
        )
      })
      .map((node) => resolveFolderExportId(node))
    return [...new Set(ids)]
  }, [selectedRecordIds, effectiveTree, batchExportMode, exportStatusOptions])

  const batchExportSelectionCount =
    selectedDossierIds.length + selectedExportFolderIds.length

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
    if (!effectiveTree) return

    const shouldDeferToDossierDeepLink =
      Boolean(dossierId?.trim()) && (isProjectScoped || role === 'qc')
    if (shouldDeferToDossierDeepLink) {
      return
    }

    const resolved = resolveDataManagementSelection(
      effectiveTree,
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
        focusFieldKey:
          resolved.focusDocumentId === focusDocumentId &&
            resolved.focusGroupIndex === focusGroupIndex
            ? prev.focusFieldKey
            : undefined,
      }),
      replace: true,
    })
  }, [
    effectiveTree,
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
            focusFieldKey: undefined,
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
    if (!tree || !nodeId || q.trim()) return
    if (isNodeChildrenCached(nodeId)) return
    const node = findNodeById(tree, nodeId)
    if (!node) return

    const needsLoad =
      node.type === 'record'
        ? !node.dossierMetadata || node.children.length === 0
        : true

    if (!needsLoad) return
    loadChildrenMutationRef.current.mutate(nodeId)
  }, [tree, nodeId, role, q])

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

  // Khi có kết quả tìm kiếm, chỉ mở các cấp cha đến node khớp (để node khớp hiển thị trên cây),
  // KHÔNG tự mở các cấp con bên trong node khớp đó (người dùng tự click nút xổ xuống nếu muốn xem tiếp).
  useEffect(() => {
    if (!q.trim() || !searchTree) return

    const trimmedQ = q.trim()
    const expandIds = new Set<string>()

    function checkNode(node: DataTreeNodeT): boolean {
      const isDirectMatch =
        Boolean(node.isSearchMatch) || matchesFuzzyFileName(node.name, trimmedQ)
      let hasMatchingDescendant = false

      for (const child of node.children) {
        if (checkNode(child)) {
          hasMatchingDescendant = true
        }
      }

      if (hasMatchingDescendant) {
        expandIds.add(node.id)
      }

      return isDirectMatch || hasMatchingDescendant
    }

    for (const child of searchTree.children) {
      checkNode(child)
    }

    setTreeExpandToNodeIds(Array.from(expandIds))
  }, [searchTree, q])

  const selectedNode = useMemo(() => {
    if (!effectiveTree || !nodeId) return null
    const node = findNodeById(effectiveTree, nodeId)
    // In search mode the searchTree node lacks dossierMetadata/children loaded by
    // loadChildrenMutation. Prefer the baseTree version if it has richer data.
    if (q.trim() && baseTree && node && !node.dossierMetadata) {
      const baseNode = findNodeById(baseTree, nodeId)
      if (baseNode?.dossierMetadata) return baseNode
    }
    return node
  }, [effectiveTree, nodeId, q, baseTree])

  const detailContext = useMemo(() => {
    if (!effectiveTree || !selectedNode) return null

    if (selectedNode.type === 'document') {
      const parent = findRecordParentForDocument(effectiveTree, selectedNode.id)
      if (parent?.type === 'record') {
        return {
          node: parent,
          focusDocumentId: selectedNode.id,
          focusGroupIndex,
          focusFieldKey,
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
        focusFieldKey,
        dossierId: resolveRecordDossierId(selectedNode),
        dossierStatus: selectedNode.dossierStatus,
      }
    }

    return {
      node: selectedNode,
      focusDocumentId: undefined,
      focusGroupIndex: undefined,
      focusFieldKey: undefined,
      dossierId: null,
      dossierStatus: undefined,
    }
  }, [tree, selectedNode, focusDocumentId, focusGroupIndex, focusFieldKey])

  const activeDetailDossierId = detailContext?.dossierId?.trim() || ''

  const [completedDocumentIds, setCompletedDocumentIds] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    if (!activeDetailDossierId) {
      setCompletedDocumentIds(new Set())
      return
    }
    setCompletedDocumentIds(loadCompletedDocumentIds(activeDetailDossierId))
  }, [activeDetailDossierId])

  const handleMarkDocumentsComplete = useCallback(
    (documentIds: Array<string>) => {
      if (!activeDetailDossierId || documentIds.length === 0) return
      setCompletedDocumentIds((prev) => {
        const next = new Set(prev)
        let changed = false
        for (const id of documentIds) {
          if (!id || next.has(id)) continue
          next.add(id)
          changed = true
        }
        if (!changed) return prev
        saveCompletedDocumentIds(activeDetailDossierId, next)
        return next
      })
    },
    [activeDetailDossierId],
  )

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
    if (!canExportDossiers) return
    const ctx = resolveExportContext(node, exportStatusOptions)
    if (!ctx) return

    setExportContext(ctx)
    if (ctx.kind === 'folder' || ctx.kind === 'multi_dossiers' || ctx.dossierId) {
      setCanExportDip(true)
    } else {
      setCanExportDip(false)
    }
    setExportDialogOpen(true)
  }

  function handleExportByFolderStructure(node: DataTreeNodeT) {
    if (!canExportDossiers) return
    if (node.type !== 'folder' || node.id === DATA_TREE_ROOT_ID) return

    setExportContext({
      kind: 'folder',
      folderId: resolveFolderExportId(node),
      dossierId: findDescendantDossierTarget(node)?.dossierId ?? null,
      downloadName: node.name,
    })
    setCanExportDip(true)
    setExportDialogOpen(true)
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
    async (modes: ExportMode[], options?: ExportOptions) => {
      if (!exportContext || isExporting || modes.length === 0) return

      setIsExporting(true)
      try {
        let dossierId = exportContext.dossierId
        if (mode === 'dip' && !dossierId && exportContext.kind !== 'multi_dossiers') {
          dossierId = await resolveDossierIdForDip(exportContext)
        }
        await runExport({
          kind: exportContext.kind,
          mode,
          folderId: exportContext.folderId,
          dossierId,
          dossierIds: exportContext.dossierIds,
          downloadName: exportContext.downloadName,
          metadataExportConfig: options?.presetId
            ? { presetId: options.presetId }
            : undefined,
          useDocumentNaming: options?.useDocumentNaming === true,
        })
        toast.success(
          mode === 'dip'
            ? t('recordDetail.exportDipSuccess')
            : mode === 'tiff'
              ? t('recordDetail.exportTiffSuccess')
              : t('recordDetail.exportExcelSuccess'),
        )
        setExportDialogOpen(false)
      } catch (error) {
        toast.error(
          translateError(
            error instanceof Error
              ? error
              : new Error(t('recordDetail.exportExcelError')),
          ),
        )
      } finally {
        setIsExporting(false)
        setExportingMode(null)
      }
    },
    [exportContext, isExporting, t],
  )

  const batchExportContext: ExportContext | null = useMemo(() => {
    if (
      selectedDossierIds.length === 0 &&
      selectedExportFolderIds.length === 0
    ) {
      return null
    }
    const parts: string[] = []
    if (selectedExportFolderIds.length > 0) {
      parts.push(`${selectedExportFolderIds.length}-folder`)
    }
    if (selectedDossierIds.length > 0) {
      parts.push(`${selectedDossierIds.length}-hoso`)
    }
    return {
      kind: 'multi_dossiers',
      dossierId: null,
      folderId: null,
      folderIds: selectedExportFolderIds,
      dossierIds: selectedDossierIds,
      downloadName: `multi-export-${parts.join('-')}`,
    }
  }, [selectedDossierIds, selectedExportFolderIds])

  const handleBatchExport = useCallback(
    async (modes: ExportMode[], options?: ExportOptions) => {
      if (!batchExportContext || isExporting || modes.length === 0) return

      setIsExporting(true)
      try {
        for (const mode of modes) {
          setBatchExportingMode(mode)
          await runExport({
            kind: batchExportContext.kind,
            mode,
            folderId: batchExportContext.folderId,
            folderIds: batchExportContext.folderIds,
            dossierId: batchExportContext.dossierId,
            dossierIds: batchExportContext.dossierIds,
            downloadName: batchExportContext.downloadName,
            metadataExportConfig: options?.presetId
              ? { presetId: options.presetId }
              : undefined,
            useDocumentNaming: options?.useDocumentNaming === true,
          })
          toast.success(
            mode === 'dip'
              ? t('recordDetail.exportDipSuccess', 'Đã tải xuống gói DIP.')
              : mode === 'tiff'
                ? t(
                    'recordDetail.exportTiffSuccess',
                    'Đã tải xuống gói TIFF.',
                  )
                : mode === 'pdf'
                  ? t(
                      'recordDetail.exportPdfSuccess',
                      'Đã tải xuống gói PDF.',
                    )
                  : t(
                      'recordDetail.exportExcelSuccess',
                      'Đã tải xuống tệp Excel.',
                    ),
          )
        }
        setBatchExportDialogOpen(false)
      } catch (error) {
        toast.error(
          translateError(
            error instanceof Error
              ? error
              : new Error(t('recordDetail.exportExcelError')),
          ),
        )
      } finally {
        setIsExporting(false)
        setBatchExportingMode(null)
      }
    },
    [batchExportContext, isExporting, t],
  )

  function handleFocusDocument(
    documentId: string | undefined,
    groupIndex: number,
    fieldKey?: string,
  ) {
    if (!tree || !nodeId) return
    const recordNode = findNodeById(tree, nodeId)
    if (recordNode?.type !== 'record') return

    const nextDocumentId = documentId ?? focusDocumentId
    const sameFocus =
      nextDocumentId === focusDocumentId &&
      groupIndex === focusGroupIndex &&
      fieldKey === focusFieldKey
    if (sameFocus) return

    void navigate({
      to: '.',
      search: (prev: DataManagementSearch) => ({
        ...prev,
        nodeId: recordNode.id,
        focusDocumentId: nextDocumentId,
        focusGroupIndex: groupIndex,
        focusFieldKey: fieldKey,
      }),
      replace: true,
    })
  }

  function navigateToNode(id: string, treeOverride?: DataTreeNodeT) {
    const activeTree = treeOverride ?? effectiveTree

    if (!activeTree) {
      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          nodeId: id,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
          focusFieldKey: undefined,
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
        focusFieldKey: undefined,
      }),
    })
  }

  async function handleSelectNode(id: string) {
    const isSearching = Boolean(q.trim())
    let workingTree = effectiveTree

    try {
      if (workingTree) {
        const targetNode = findNodeById(workingTree, id)

        if (
          (batchSignMode || batchExportMode) &&
          targetNode &&
          (batchSignMode
            ? isBatchSignSelectableNode(targetNode)
            : isBatchExportSelectableNode(targetNode, exportStatusOptions))
        ) {
          if (batchExportMode) {
            // Toggle this node only — folders export via folderId (no subtree load).
            const appearsChecked =
              selectedRecordIds.includes(id) ||
              isUnderSelectedBatchExportFolder(
                targetNode,
                workingTree,
                selectedRecordIds,
                exportStatusOptions,
              )

            setSelectedRecordIds((prev) => {
              if (appearsChecked) {
                // Uncheck: remove this id and any selected ancestor folders
                // that were making a leaf appear checked.
                const next = new Set(prev)
                next.delete(id)
                let parentId = targetNode.parentId
                while (parentId) {
                  if (next.has(parentId)) {
                    const parent = findNodeById(workingTree!, parentId)
                    if (
                      parent &&
                      parent.type === 'folder' &&
                      !isBatchExportDossierLeafNode(
                        parent,
                        exportStatusOptions,
                      )
                    ) {
                      next.delete(parentId)
                    }
                  }
                  const parent = findNodeById(workingTree!, parentId)
                  if (!parent) break
                  parentId = parent.parentId
                }
                return [...next]
              }
              // Check: add this id and drop any selected descendants —
              // folder API already covers the whole subtree.
              const next = new Set(prev)
              next.add(id)
              for (const selectedId of prev) {
                if (selectedId === id) continue
                if (
                  isNodeUnderAncestor(workingTree!, selectedId, id)
                ) {
                  next.delete(selectedId)
                }
              }
              return [...next]
            })
            return
          }

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
              const loaded = await loadNodeTree(loadId)
              if (!isSearching) workingTree = loaded
            }
          }
        } else if (targetNode?.type === 'folder' && isProjectScoped) {
          const isStaleDossierFolder =
            isDossierWorkflowNode(targetNode) &&
            targetNode.children.length === 0 &&
            isNodeChildrenCached(id)

          if (isStaleDossierFolder || !isNodeChildrenCached(id)) {
            const loaded = await loadNodeTree(
              id,
              isStaleDossierFolder ? { refresh: true } : undefined,
            )
            if (!isSearching) workingTree = loaded
          }
        } else if (targetNode?.type === 'record') {
          if (!targetNode.dossierMetadata) {
            const loaded = await loadChildrenMutation
              .mutateAsync(id)
              .then((r) => r.tree)
            if (!isSearching) workingTree = loaded
          }
        } else if (!isNodeChildrenCached(id)) {
          loadChildrenMutation.mutate(id)
        }
      }
    } catch {
      toast.error(t('errors.loadFailed'))
      return
    }

    navigateToNode(id, isSearching ? undefined : (workingTree ?? undefined))
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
          focusFieldKey: undefined,
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
        focusFieldKey: undefined,
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

  async function handleEditorClaimNext(options?: {
    clearUrlFirst?: boolean
    excludeDossierId?: string
  }) {
    if (options?.clearUrlFirst) {
      await clearDataManagementSelectionInUrl()
    }
    const nextTree = await claimNextMutation.mutateAsync()
    const nextRecord = nextTree.children.find((child) => child.type === 'record')
    const nextDossierId = nextRecord
      ? resolveRecordDossierId(nextRecord)
      : undefined

    if (
      !nextDossierId ||
      (options?.excludeDossierId &&
        nextDossierId === options.excludeDossierId)
    ) {
      await queryClient.invalidateQueries({
        queryKey: editorDraftDossiersQueryKey,
      })
      void navigate({
        to: '/app/dossiers',
        search: {},
      })
      return
    }

    await navigateToDefaultDataManagementSelection(nextTree)
  }

  async function handleMetadataReload(
    reloadDossierId: string,
    mode: 'draft' | 'draft_advance' | 'final' | 'error_report' = 'draft',
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

        if (mode === 'draft_advance') {
          try {
            await handleEditorClaimNext({
              clearUrlFirst: true,
              excludeDossierId: reloadDossierId,
            })
          } catch (claimError) {
            if (isNoAssignedDossierError(claimError)) {
              toast.info(t('errors.noAssignedDossier'))
              void navigate({
                to: '/app/dossiers',
                search: {},
              })
              return
            }
            throw claimError
          }
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

      if (reloadDossierId) {
        await refreshDossierContentMutation
          .mutateAsync(reloadDossierId)
          .catch(() => null)
        return
      }

      const targetNodeId = focusDocumentId ?? nodeId ?? reloadDossierId
      if (targetNodeId) {
        setTreeExpandToNodeIds((prev) => [
          ...new Set([...prev, targetNodeId, reloadDossierId]),
        ])
      }
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
      <ResizablePanelGroup
        direction="horizontal"
        className="relative flex h-0 min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border"
      >
        {isResolvingDossierDeepLink ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
            <p className="text-sm text-muted-foreground">
              {t('dossierDeepLink.resolving')}
            </p>
          </div>
        ) : null}

        {treeCollapsed && (
          <button
            type="button"
            onClick={() => setTreeCollapsed(false)}
            aria-label={t('tree.expand')}
            className="absolute left-3 top-3 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
          >
            <ArrowRightFromLine className="size-3.5" />
          </button>
        )}

        {!treeCollapsed && (
          <>
            <ResizablePanel
              defaultSize={25}
              minSize={15}
              maxSize={40}
              className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-card"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {showSearch || (isProjectScoped && permissions.canReadProjects) ? (
                  <div className="shrink-0 space-y-1.5 border-b border-border px-2.5 py-1.5">
                    {isProjectScoped && permissions.canReadProjects ? (
                      <ProjectSelect
                        className="w-full"
                        compact
                        value={projectCode}
                        onValueChange={handleProjectChange}
                      />
                    ) : null}
                    {showSearch ? (
                      <div className="relative flex items-center">
                        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder={t('search.placeholder')}
                          className="w-full bg-background pl-8 pr-8"
                          value={localSearchQuery}
                          onChange={(e) => {
                            const val = e.target.value
                            setLocalSearchQuery(val)
                            if (!val.trim() && q) {
                              handleSearchInput('')
                            }
                          }}
                          onSearch={(e) => {
                            const target = e.target as HTMLInputElement
                            setLocalSearchQuery(target.value)
                            handleSearchInput(target.value)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSearchInput(localSearchQuery)
                            }
                          }}
                          aria-label={t('search.placeholder')}
                        />
                        {localSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLocalSearchQuery('')
                              handleSearchInput('')
                            }}
                            className="absolute right-2 flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                            title="Xóa tìm kiếm"
                            aria-label="Xóa tìm kiếm"
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
            {isSearching && (isSearchFetching || !searchTree) ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mb-2 size-6 animate-spin text-muted-foreground/60" />
                <p>{t('search.searching', 'Đang tìm kiếm...')}</p>
              </div>
            ) : isSearchEmpty ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <Search className="mb-2 size-8 text-muted-foreground/40" />
                <p className="font-medium text-foreground">
                  {t('search.noResults', 'Không tìm thấy kết quả')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'search.noResultsDesc',
                    'Không có thư mục hoặc tài liệu nào phù hợp với "{{query}}"',
                    { query: q },
                  )}
                </p>
              </div>
            ) : displayTree ? (
              <DataFolderTree
                key={`tree-${projectCode ?? 'all'}-${isSearching ? `search-${q.trim()}` : 'browse'}`}
                tree={displayTree}
                selectedId={focusDocumentId ?? nodeId}
                selectedIds={selectedRecordIds}
                multiSelect={batchSignMode || batchExportMode}
                multiSelectTarget="record"
                isMultiSelectNode={
                  batchSignMode
                    ? isBatchSignSelectableNode
                    : batchExportMode
                      ? (node) =>
                          isBatchExportSelectableNode(node, exportStatusOptions)
                      : undefined
                }
                getMultiSelectCheckedState={
                  batchExportMode
                    ? (node) =>
                        getBatchExportCheckState(
                          node,
                          selectedRecordIds,
                          exportStatusOptions,
                          effectiveTree,
                        )
                    : undefined
                }
                expandPathToNodeIds={treeExpandToNodeIds}
                onExpandPathApplied={() => setTreeExpandToNodeIds([])}
                pendingErrorReportDossierIds={pendingErrorReportDossierIds}
                completedDocumentIds={completedDocumentIds}
                showProjectCode={
                  isProjectScoped && isAllProjects && permissions.canReadProjects
                }
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
            </ResizablePanel>
            <ResizableHandle className="relative w-px bg-border">
              <button
                type="button"
                onClick={() => setTreeCollapsed(true)}
                aria-label={t('tree.collapse')}
                className="absolute top-3 z-10 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
              >
                <ArrowLeftToLine className="size-3.5" />
              </button>
            </ResizableHandle>
          </>
        )}

        <ResizablePanel
          defaultSize={treeCollapsed ? 100 : 75}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2.5 py-1.5">
            <div
              className={cn('min-w-0 flex-1', treeCollapsed ? 'pl-8' : 'pl-5')}
            >
              <DataTreeBreadcrumb
                tree={effectiveTree ?? tree}
                nodeId={nodeId}
                role={role}
              />
            </div>
            {permissions.canDigitalSign ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={batchSignMode ? 'secondary' : 'outline'}
                  className="shrink-0 gap-1.5"
                  onClick={() => {
                    setBatchSignMode((prev) => {
                      const next = !prev
                      if (next) {
                        setBatchExportMode(false)
                      }
                      setSelectedRecordIds([])
                      return next
                    })
                  }}
                >
                  <PenLine className="size-3.5" aria-hidden />
                  {batchSignMode
                    ? t('digitalSign.exitBatchMode')
                    : t('digitalSign.batchMode')}
                </Button>
                {batchSignMode ? (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={selectedDossierIds.length === 0}
                    onClick={() => {
                      void (async () => {
                        const ready = await ensureSignAgentReady()
                        if (!ready.ok) {
                          toast.error(ready.message, {
                            action: ready.downloadUrl
                              ? {
                                label: 'Tải Sign Agent',
                                onClick: () =>
                                  window.open(
                                    ready.downloadUrl ?? SIGN_AGENT_DOWNLOAD_URL,
                                    '_blank',
                                    'noopener,noreferrer',
                                  ),
                              }
                              : undefined,
                          })
                          return
                        }
                        setBatchSignDrawerOpen(true)
                      })()
                    }}
                  >
                    <PenLine className="size-3.5" aria-hidden />
                    {t('digitalSign.batchAction', {
                      count: selectedDossierIds.length,
                    })}
                  </Button>
                ) : null}
              </>
            ) : null}
            {canExportDossiers ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={batchExportMode ? 'secondary' : 'outline'}
                  className="shrink-0 gap-1.5"
                  onClick={() => {
                    setBatchExportMode((prev) => {
                      const next = !prev
                      if (next) {
                        setBatchSignMode(false)
                      }
                      setSelectedRecordIds([])
                      return next
                    })
                  }}
                >
                  <FolderUp className="size-3.5" aria-hidden />
                  {batchExportMode
                    ? t('recordDetail.exportExcelExitBatchMode', 'Thoát chọn xuất')
                    : t('recordDetail.exportExcelBatchMode', 'Chọn hồ sơ xuất')}
                </Button>
                {batchExportMode ? (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={selectedDossierIds.length === 0 || isExporting}
                    onClick={() => {
                      if (selectedDossierIds.length === 0) return
                      setExportContext({
                        kind: 'multi_dossiers',
                        folderId: null,
                        dossierId: null,
                        dossierIds: selectedDossierIds,
                        downloadName: `multi-export-${selectedDossierIds.length}-hoso`,
                      })
                      setCanExportDip(true)
                      setExportDialogOpen(true)
                    }}
                  >
                    <FolderUp className="size-3.5" aria-hidden />
                    {t('recordDetail.exportExcelRunBatch', {
                      count: batchExportSelectionCount,
                      defaultValue: `Xuất {{count}} mục đã chọn`,
                    })}
                  </Button>
                ) : null}
              </>
            ) : null}
            {permissions.canUpload && (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="shrink-0 gap-1.5"
                onClick={() => {
                  setUploadTargetFolder(null)
                  setUploadOpen(true)
                }}
              >
                <FolderUp className="size-3.5" aria-hidden />
                {t('actions.uploadFolder')}
              </Button>
            )}
          </div>
          <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden p-1.5">
            <DataNodeDetailPanel
              node={detailContext?.node ?? null}
              role={role}
              dossierId={detailContext?.dossierId}
              dossierStatus={detailContext?.dossierStatus}
              isEditorDraftView={isEditorDraftView}
              focusDocumentId={detailContext?.focusDocumentId}
              focusGroupIndex={detailContext?.focusGroupIndex}
              focusFieldKey={detailContext?.focusFieldKey}
              onFocusDocument={handleFocusDocument}
              onMarkDocumentsComplete={handleMarkDocumentsComplete}
              onSelectNode={(id) => {
                void handleSelectNode(id)
              }}
              onViewInfo={(node) => {
                setViewInfoNode(node)
                setViewInfoOpen(true)
              }}
              onContextMenuNode={(node, x, y) => setContextMenu({ node, x, y })}
              onWorkflowComplete={handleMetadataReload}
              onDigitalSignCompleted={handleDigitalSignCompleted}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

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
      <AssignPdfDocumentDialog
        open={assignPdfOpen}
        onOpenChange={(open) => {
          setAssignPdfOpen(open)
          if (!open) setAssignPdfTargetNode(null)
        }}
        role={role}
        projectCode={projectCode}
        targetNode={assignPdfTargetNode}
        onAssignSuccess={async () => {
          if (nodeId) {
            await loadNodeTree(nodeId, true)
          }
        }}
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
        parentNode={contextMenu?.node?.parentId ? findNodeById(tree, contextMenu.node.parentId) : null}
        open={!!contextMenu}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onAction={(node, mode) => setActionState({ node, mode })}
        onViewInfo={(node) => {
          setViewInfoNode(node)
          setViewInfoOpen(true)
        }}
        onExportExcel={(node) => void handleExportExcel(node)}
        onExportByFolderStructure={(node) =>
          void handleExportByFolderStructure(node)
        }
        onUploadDossier={(node) => {
          setUploadTargetFolder(node)
          setUploadOpen(true)
        }}
        onUploadDocument={(node) => {
          setUploadTargetRecord(node)
          setDocumentUploadOpen(true)
        }}
        onAssignPdfDocument={(node) => {
          setAssignPdfTargetNode(node)
          setAssignPdfOpen(true)
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
      <ExportChoiceDialog
        open={batchExportDialogOpen}
        onOpenChange={setBatchExportDialogOpen}
        context={batchExportContext}
        canExportDip={Boolean(
          batchExportContext?.dossierIds?.length ||
            batchExportContext?.folderIds?.length,
        )}
        onExport={handleBatchExport}
        isExporting={isExporting}
        exportingMode={batchExportingMode}
      />
      <BatchDigitalSignDrawer
        open={batchSignDrawerOpen}
        onOpenChange={setBatchSignDrawerOpen}
        dossierIds={selectedDossierIds}
        onCompleted={() => {
          // Refresh each selected dossier so signed badges appear on tree
          // files, without clearing batch selection / mode.
          void Promise.all(
            selectedDossierIds.map((id) =>
              refreshDossierContentMutation.mutateAsync(id).catch(() => null),
            ),
          )
        }}
      />
    </>
  )

  return wrapDataDigitizationPage(<div className={containerClass}>{content}</div>)
}
