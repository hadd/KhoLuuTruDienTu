import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createProject,
  deleteProject,
  getProjectDetail,
  getProjectProgressHistory,
  getProjects,
  updateProject,
} from '@/features/project-manager/api/projectManagerClient'
import {
  closeAdminIssueReport,
  getAdminIssueReports,
} from '@/features/project-manager/api/issueReportClient'
import { getProjectManagerCandidates } from '@/features/project-manager/api/projectManagerUserClient'
import type {
  CloseAdminIssueReportPayloadT,
  CreateProjectPayloadT,
  GetProjectsParamsT,
  UpdateProjectPayloadT,
} from '@/features/project-manager/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const DEFAULT_PROJECTS_LIMIT = 50

export const projectsQueryKeyPrefix = ['admin', 'projects'] as const

export const projectsQueryKey = (params?: GetProjectsParamsT) =>
  [...projectsQueryKeyPrefix, params ?? {}] as const

export const projectDetailQueryKey = (projectId: string) =>
  [...projectsQueryKeyPrefix, 'detail', projectId] as const

export const projectProgressHistoryQueryKey = (projectId: string) =>
  [...projectsQueryKeyPrefix, 'progress-history', projectId] as const

export const projectManagerCandidatesQueryKey = [
  'admin',
  'users',
  'by-permission',
  'project-managers',
] as const

export const projectManagerCandidatesQueryOptions = () =>
  queryOptions({
    queryKey: projectManagerCandidatesQueryKey,
    queryFn: getProjectManagerCandidates,
    staleTime: 60_000,
  })

export const adminIssueReportsQueryKey = [
  'admin',
  'issue-reports',
] as const

export const adminIssueReportsQueryOptions = () =>
  queryOptions({
    queryKey: adminIssueReportsQueryKey,
    queryFn: getAdminIssueReports,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

export function useCloseIssueReportMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      reportId,
      payload,
    }: {
      reportId: string
      payload: CloseAdminIssueReportPayloadT
    }) => closeAdminIssueReport(reportId, payload),
    onSuccess: () => {
      toast.success(
        i18n.t('issueReports.close.success', { ns: 'project-manager' }),
      )
      void queryClient.invalidateQueries({
        queryKey: adminIssueReportsQueryKey,
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('issueReports.close.error', { ns: 'project-manager' }),
      )
    },
  })
}

export const projectsQueryOptions = (params?: GetProjectsParamsT) =>
  queryOptions({
    queryKey: projectsQueryKey(params),
    queryFn: () =>
      getProjects({
        limit: params?.limit ?? DEFAULT_PROJECTS_LIMIT,
        offset: params?.offset ?? 0,
      }),
    staleTime: 60_000,
  })

export const projectDetailQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: () => getProjectDetail(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })

export const projectProgressHistoryQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: projectProgressHistoryQueryKey(projectId),
    queryFn: () => getProjectProgressHistory(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProjectPayloadT) => createProject(payload),
    onSuccess: () => {
      toast.success(i18n.t('form.success.create', { ns: 'project-manager' }))
      void queryClient.invalidateQueries({ queryKey: projectsQueryKeyPrefix })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('form.error.create', { ns: 'project-manager' }),
      )
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: string
      payload: UpdateProjectPayloadT
    }) => updateProject(projectId, payload),
    onSuccess: (_data, variables) => {
      toast.success(i18n.t('form.success.update', { ns: 'project-manager' }))
      void queryClient.invalidateQueries({ queryKey: projectsQueryKeyPrefix })
      void queryClient.invalidateQueries({
        queryKey: projectDetailQueryKey(variables.projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: projectProgressHistoryQueryKey(variables.projectId),
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('form.error.update', { ns: 'project-manager' }),
      )
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      toast.success(i18n.t('delete.success', { ns: 'project-manager' }))
      void queryClient.invalidateQueries({ queryKey: projectsQueryKeyPrefix })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'project-manager' }),
      )
    },
  })
}
