import type { Query, QueryClient } from '@tanstack/react-query'
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useRef } from 'react'

import {
  persistDossierMetadataByRole,
  rejectCheckerDossier,
} from '@/features/data-management/api/dataEntryClient'
import type {
  DataDeleteRequestT,
  LoadNodeChildrenResultT,
} from '@/features/data-management/api/dataManagementClient'
import {
  addDataFolder,
  assignDataRecord,
  assignDossierEditor,
  deleteDataNode,
  fetchDossierMetadataHistory,
  getDataTree,
  loadNodeChildren,
  refreshDossierContent,
  renameDataNode,
  restoreDossierMetadataHistory,
  revokeFolderAssignments,
  updateDossier,
  uploadDataDocuments,
  uploadDataFolder,
} from '@/features/data-management/api/dataManagementClient'
import type {
  UploadFolderOptions,
  UploadFolderResult,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import {
  confirmIssueReport,
  escalateIssueReport,
  fetchEditorErrorReportsByDossier,
  rejectIssueReport,
  submitEditorErrorReport,
} from '@/features/data-management/api/editorErrorReportClient'
import { getProjects } from '@/features/data-management/api/projectClient'
import {
  isProjectScopedDataRole,
  type DataManagementRole,
} from '@/features/data-management/config/roleConfig'
import {
  countTreePendingIssueReports,
  mapIssueReportToEditorErrorReport,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  decrementDossierPendingIssueReportCountInTree,
  updateDossierMetadataInTree,
  updateDossierPendingIssueReportCountInTree,
} from '@/features/data-management/lib/treeUtils'
import type {
  DataDossierMetadataT,
  DataTreeNodeT,
  EditorErrorReportT,
} from '@/features/data-management/types'

export const issueReportsByDossierQueryKey = (dossierId: string) =>
  ['data-management', 'issue-reports', dossierId] as const

function mergeIssueReportIntoCache(
  current: Array<EditorErrorReportT> | undefined,
  mapped: EditorErrorReportT,
): Array<EditorErrorReportT> {
  if (!current?.length) return [mapped]
  const index = current.findIndex((report) => report.id === mapped.id)
  if (index === -1) return [...current, mapped]
  return current.map((report, reportIndex) =>
    reportIndex === index ? { ...report, ...mapped } : report,
  )
}

/** Seed issue-report query cache from maker/claim `issueReport` on the tree node. */
export function syncEditorIssueReportFromTree(
  qc: QueryClient,
  tree: DataTreeNodeT,
) {
  const record = tree.children.find((child) => child.type === 'record')
  if (!record?.dossierId || !record.claimIssueReport) return

  const mapped = mapIssueReportToEditorErrorReport(
    record.claimIssueReport,
    record.name,
  )
  qc.setQueryData<Array<EditorErrorReportT>>(
    issueReportsByDossierQueryKey(record.dossierId),
    (current) => mergeIssueReportIntoCache(current, mapped),
  )
}

/** Seed issue-report query cache from QC assignment `issueReports` on tree nodes. */
export function syncQcIssueReportsFromTree(
  qc: QueryClient,
  tree: DataTreeNodeT,
) {
  function walk(node: DataTreeNodeT) {
    if (
      node.type === 'record' &&
      node.dossierId &&
      node.assignmentIssueReports?.length
    ) {
      const dossierId = node.dossierId
      const dossierName = node.name
      qc.setQueryData<Array<EditorErrorReportT>>(
        issueReportsByDossierQueryKey(dossierId),
        (current) => {
          let next = current ?? []
          for (const report of node.assignmentIssueReports ?? []) {
            next = mergeIssueReportIntoCache(
              next,
              mapIssueReportToEditorErrorReport(report, dossierName),
            )
          }
          return next
        },
      )
    }
    for (const child of node.children) {
      walk(child)
    }
  }

  walk(tree)
}

export const issueReportsByDossierQueryOptions = (
  dossierId: string,
  dossierName = '',
) =>
  queryOptions({
    queryKey: issueReportsByDossierQueryKey(dossierId),
    queryFn: () => fetchEditorErrorReportsByDossier(dossierId, dossierName),
    staleTime: 15_000,
    enabled: Boolean(dossierId.trim()),
  })

export const dataManagementTreeQueryKey = (
  role: DataManagementRole,
  projectCode?: string,
  dossierId?: string,
) => {
  if (isProjectScopedDataRole(role) && projectCode) {
    return [role, 'data-management', 'tree', projectCode] as const
  }
  if (dossierId) {
    return [role, 'data-management', 'tree', dossierId] as const
  }
  return [role, 'data-management', 'tree'] as const
}

export const dataManagementProjectsQueryKey = [
  'data-management',
  'projects',
] as const

export const dataManagementProjectsQueryOptions = () =>
  queryOptions({
    queryKey: dataManagementProjectsQueryKey,
    queryFn: () => getProjects(),
    staleTime: 60_000,
  })

export const dossierMetadataHistoryQueryKey = (dossierId: string) =>
  ['data-management', 'dossier-metadata-history', dossierId] as const

export const dossierMetadataHistoryQueryOptions = (dossierId: string) =>
  queryOptions({
    queryKey: dossierMetadataHistoryQueryKey(dossierId),
    queryFn: () => fetchDossierMetadataHistory(dossierId),
    staleTime: 30_000,
    enabled: Boolean(dossierId.trim()),
  })

function setQueryErrorWithoutRefetch(
  qc: QueryClient,
  queryKey: ReturnType<typeof dataManagementTreeQueryKey>,
  error: unknown,
): void {
  qc.setQueryData(queryKey, undefined)
  const query = qc.getQueryCache().find({ queryKey })
  query?.setState({
    status: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
    fetchStatus: 'idle',
  })
}

export const dataManagementTreeQueryOptions = (
  role: DataManagementRole,
  projectCode?: string,
  dossierId?: string,
) =>
  queryOptions({
    queryKey: dataManagementTreeQueryKey(role, projectCode, dossierId),
    queryFn: () =>
      getDataTree(role, {
        projectCode,
        ...(role === 'editor' && dossierId ? { refresh: true, dossierId } : {}),
      }),
    staleTime: 30_000,
    enabled: !isProjectScopedDataRole(role) || Boolean(projectCode?.trim()),
    retry: (failureCount, error) =>
      !isNoAssignedDossierError(error) && failureCount < 1,
    ...(role === 'editor'
      ? {
          refetchOnMount: (
            query: Query<
              DataTreeNodeT,
              Error,
              DataTreeNodeT,
              ReturnType<typeof dataManagementTreeQueryKey>
            >,
          ) => !isNoAssignedDossierError(query.state.error),
        }
      : {}),
  })

export function useUploadDataFolderMutation(
  role: DataManagementRole,
  projectCode?: string,
  onProgress?: (p: UploadProgress) => void,
) {
  const qc = useQueryClient()
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const projectCodeRef = useRef(projectCode)
  projectCodeRef.current = projectCode

  return useMutation<
    UploadFolderResult,
    Error,
    { files: Array<File> } & UploadFolderOptions
  >({
    mutationFn: ({
      files,
      uploadPoint,
      allowOverwrite,
      skipPathCheck,
      storagePathPrefix,
      projectCode: requestProjectCode,
    }) =>
      uploadDataFolder(files, (p) => onProgressRef.current?.(p), {
        uploadPoint,
        allowOverwrite,
        skipPathCheck,
        projectCode: requestProjectCode ?? projectCodeRef.current,
        storagePathPrefix,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCodeRef.current),
      })
    },
  })
}

export function useRenameDataNodeMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameDataNode(id, name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useUploadDataDocumentsMutation(
  role: DataManagementRole,
  projectCode?: string,
  onProgress?: (p: UploadProgress) => void,
) {
  const qc = useQueryClient()
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const projectCodeRef = useRef(projectCode)
  projectCodeRef.current = projectCode

  return useMutation<
    UploadFolderResult,
    Error,
    { files: Array<File> } & UploadFolderOptions
  >({
    mutationFn: ({
      files,
      uploadPoint,
      allowOverwrite,
      skipPathCheck,
      storagePathPrefix,
      projectCode: requestProjectCode,
    }) =>
      uploadDataDocuments(files, (p) => onProgressRef.current?.(p), {
        uploadPoint,
        allowOverwrite,
        skipPathCheck,
        projectCode: requestProjectCode ?? projectCodeRef.current,
        storagePathPrefix,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCodeRef.current),
      })
    },
  })
}

export function useDeleteDataNodeMutation(
  _role: DataManagementRole,
  _projectCode?: string,
) {
  return useMutation<void, Error, DataDeleteRequestT>({
    mutationFn: deleteDataNode,
  })
}

export function useAddDataFolderMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string) => addDataFolder(parentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useUpdateDossierMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateDossier,
    onSuccess: (tree) => {
      if (tree) {
        qc.setQueryData(dataManagementTreeQueryKey(role, projectCode), tree)
        return
      }
      void qc.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCode),
      })
    },
  })
}

export function useAssignDataRecordMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDataRecord,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useAssignDossierEditorMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignDossierEditor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useRevokeFolderAssignmentsMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (folderId: string) => revokeFolderAssignments(folderId),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role, projectCode),
      })
    },
  })
}

export type LoadNodeChildrenMutationInput =
  | string
  | { nodeId: string; refresh?: boolean }

export function useLoadNodeChildrenMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoadNodeChildrenMutationInput) => {
      const nodeId = typeof input === 'string' ? input : input.nodeId
      const refresh = typeof input === 'string' ? false : input.refresh
      return loadNodeChildren(nodeId, role, { refresh, projectCode })
    },
    onSuccess: (result: LoadNodeChildrenResultT) => {
      if (result.changed) {
        qc.setQueryData(
          dataManagementTreeQueryKey(role, projectCode),
          result.tree,
        )
      }
    },
  })
}

export function useClaimNextMakerAssignmentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => getDataTree('editor', { refresh: true, claimNext: true }),
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey('editor'), tree)
      syncEditorIssueReportFromTree(qc, tree)
    },
    onError: (error) => {
      if (!isNoAssignedDossierError(error)) return
      setQueryErrorWithoutRefetch(
        qc,
        dataManagementTreeQueryKey('editor'),
        error,
      )
    },
  })
}

export function useRefreshEditorDossierMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId: string) =>
      getDataTree('editor', { refresh: true, dossierId }),
    onSuccess: (tree, dossierId) => {
      qc.setQueryData(
        dataManagementTreeQueryKey('editor', undefined, dossierId),
        tree,
      )
    },
  })
}

export function useRefreshDataManagementTreeMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId?: string) => {
      if (role === 'editor') {
        return getDataTree('editor', { refresh: true, dossierId })
      }
      return getDataTree(role, { refresh: true, projectCode })
    },
    onSuccess: (tree, dossierId) => {
      qc.setQueryData(
        dataManagementTreeQueryKey(role, projectCode, dossierId),
        tree,
      )
      if (role === 'qc') {
        syncQcIssueReportsFromTree(qc, tree)
      }
    },
  })
}

export function useRefreshDossierContentMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dossierId: string) => refreshDossierContent(dossierId),
    onSuccess: (tree) => {
      qc.setQueryData(dataManagementTreeQueryKey(role), tree)
    },
  })
}

export function useRejectCheckerDossierMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      notes,
      rejectFields,
    }: {
      dossierId: string
      notes: string
      rejectFields: Array<string>
    }) =>
      rejectCheckerDossier(dossierId, {
        notes,
        reject_fields: rejectFields,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dataManagementTreeQueryKey(role) })
    },
  })
}

export function useRestoreDossierMetadataHistoryMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      historyId,
    }: {
      dossierId: string
      historyId: string
    }) => restoreDossierMetadataHistory(dossierId, historyId),
    onSuccess: (_result, { dossierId }) => {
      void qc.invalidateQueries({
        queryKey: dossierMetadataHistoryQueryKey(dossierId),
      })
    },
  })
}

export function useSaveDossierMetadataMutation(role: DataManagementRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dossierId,
      metadata,
      isDraft = false,
      saveMode = 'approve',
      storagePayload,
    }: {
      dossierId: string
      metadata: DataDossierMetadataT
      isDraft?: boolean
      saveMode?: 'approve' | 'summary'
      storagePayload?: Record<string, unknown>
    }) =>
      persistDossierMetadataByRole(role, dossierId, metadata, {
        isDraft,
        saveMode,
        storagePayload,
      }),
    onSuccess: (_result, { dossierId, metadata }) => {
      qc.setQueriesData<DataTreeNodeT>(
        { queryKey: [role, 'data-management', 'tree'] },
        (currentTree) => {
          if (!currentTree) return currentTree
          return updateDossierMetadataInTree(currentTree, dossierId, metadata)
        },
      )
      void qc.invalidateQueries({
        queryKey: dossierMetadataHistoryQueryKey(dossierId),
      })
    },
  })
}

export async function refreshDataManagementTreeQuery(
  qc: QueryClient,
  role: DataManagementRole,
  projectCode?: string,
) {
  const treeQueryKey = dataManagementTreeQueryKey(role, projectCode)
  const freshTree = await getDataTree(role, { refresh: true, projectCode })
  qc.setQueryData(treeQueryKey, freshTree)
  return freshTree
}

function refreshDataManagementTreeCache(
  qc: QueryClient,
  role: DataManagementRole,
  projectCode?: string,
) {
  void refreshDataManagementTreeQuery(qc, role, projectCode)
}

function invalidateIssueReportQueries(
  qc: QueryClient,
  dossierId: string,
  role: DataManagementRole,
  projectCode?: string,
  options?: { skipTreeRefresh?: boolean },
) {
  void qc.invalidateQueries({
    queryKey: issueReportsByDossierQueryKey(dossierId),
  })
  if (!options?.skipTreeRefresh) {
    refreshDataManagementTreeCache(qc, role, projectCode)
  }
}

function syncPendingIssueReportCountInTree(
  qc: QueryClient,
  dossierId: string,
  role: DataManagementRole,
  projectCode?: string,
) {
  const reports = qc.getQueryData<Array<EditorErrorReportT>>(
    issueReportsByDossierQueryKey(dossierId),
  )

  const applyUpdate = (
    queryKey: ReturnType<typeof dataManagementTreeQueryKey>,
  ) => {
    qc.setQueryData<DataTreeNodeT>(queryKey, (currentTree) => {
      if (!currentTree) return currentTree
      if (reports) {
        return updateDossierPendingIssueReportCountInTree(
          currentTree,
          dossierId,
          countTreePendingIssueReports(reports, dossierId),
        )
      }
      return decrementDossierPendingIssueReportCountInTree(
        currentTree,
        dossierId,
      )
    })
  }

  applyUpdate(dataManagementTreeQueryKey(role, projectCode))
}

function patchIssueReportInCache(
  qc: QueryClient,
  dossierId: string,
  reportId: string,
  patch: Partial<EditorErrorReportT>,
) {
  qc.setQueryData<Array<EditorErrorReportT>>(
    issueReportsByDossierQueryKey(dossierId),
    (current) => {
      if (!current) return current
      return current.map((report) =>
        report.id === reportId ? { ...report, ...patch } : report,
      )
    },
  )
}

export function useConfirmIssueReportMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { reportId: string; dossierId: string }) =>
      confirmIssueReport(input.reportId),
    onSuccess: (_result, { dossierId, reportId }) => {
      patchIssueReportInCache(qc, dossierId, reportId, {
        status: 'qc_confirmed',
        reviewedAt: new Date().toISOString(),
      })
      syncPendingIssueReportCountInTree(qc, dossierId, role, projectCode)
      invalidateIssueReportQueries(qc, dossierId, role, projectCode)
    },
  })
}

export function useRejectIssueReportMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      reportId: string
      dossierId: string
      rejectNote: string
      rejectFields?: Array<string>
    }) =>
      rejectIssueReport(input.reportId, {
        rejectNote: input.rejectNote,
        rejectFields: input.rejectFields ?? [],
      }),
    onSuccess: (result, { dossierId, reportId }) => {
      const resolveNotes = result.issueReport.resolveNotes?.trim() ?? ''
      patchIssueReportInCache(qc, dossierId, reportId, {
        status: role === 'manager' ? 'manager_rejected' : 'qc_rejected',
        reviewedAt: result.issueReport.resolvedAt ?? new Date().toISOString(),
        ...(resolveNotes ? { rejectNote: resolveNotes } : {}),
      })
      syncPendingIssueReportCountInTree(qc, dossierId, role, projectCode)
      invalidateIssueReportQueries(qc, dossierId, role, projectCode)
    },
  })
}

export function useEscalateIssueReportMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { reportId: string; dossierId: string }) =>
      escalateIssueReport(input.reportId),
    onSuccess: (_result, { dossierId, reportId }) => {
      patchIssueReportInCache(qc, dossierId, reportId, {
        status: 'pending_manager',
        reviewedAt: new Date().toISOString(),
      })
      syncPendingIssueReportCountInTree(qc, dossierId, role, projectCode)
      invalidateIssueReportQueries(qc, dossierId, role, projectCode)
      void qc.invalidateQueries({
        queryKey: dossierMetadataHistoryQueryKey(dossierId),
      })
    },
  })
}

export function useSubmitEditorErrorReportMutation(
  role: DataManagementRole,
  projectCode?: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: submitEditorErrorReport,
    onSuccess: (_result, { dossierId }) => {
      // Editor sẽ claim hồ sơ mới ngay sau (onWorkflowComplete),
      // skip refresh tree ở đây để tránh race với claimNext.
      invalidateIssueReportQueries(qc, dossierId, role, projectCode, {
        skipTreeRefresh: role === 'editor',
      })
    },
  })
}
