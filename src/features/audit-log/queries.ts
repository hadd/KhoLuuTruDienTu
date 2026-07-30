import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  deleteAuditLog,
  deleteAuditLogsBulk,
  exportAuditLogs,
  getAuditLog,
  getAuditLogArchives,
  getAuditLogs,
  purgeAuditLogs,
} from '@/features/audit-log/api/auditLogClient'
import type { GetAuditLogsParamsT } from '@/features/audit-log/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const auditLogsQueryKeyPrefix = ['admin', 'audit-logs'] as const

export const auditLogsQueryKey = (params?: GetAuditLogsParamsT) =>
  [...auditLogsQueryKeyPrefix, params ?? {}] as const

export const auditLogDetailQueryKey = (id: string) =>
  [...auditLogsQueryKeyPrefix, 'detail', id] as const

export const auditLogArchivesQueryKey = (params?: {
  page?: number
  limit?: number
}) => [...auditLogsQueryKeyPrefix, 'archives', params ?? {}] as const

export const auditLogsQueryOptions = (params?: GetAuditLogsParamsT) =>
  queryOptions({
    queryKey: auditLogsQueryKey(params),
    queryFn: () => getAuditLogs(params),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })

export const auditLogDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: auditLogDetailQueryKey(id),
    queryFn: () => getAuditLog(id),
    enabled: Boolean(id),
  })

export const auditLogArchivesQueryOptions = (params?: {
  page?: number
  limit?: number
}) =>
  queryOptions({
    queryKey: auditLogArchivesQueryKey(params),
    queryFn: () => getAuditLogArchives(params),
    staleTime: 30_000,
  })

export function useDeleteAuditLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAuditLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditLogsQueryKeyPrefix })
      toast.success(i18n.t('delete.success', { ns: 'audit-log' }))
    },
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteAuditLogsBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAuditLogsBulk,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: auditLogsQueryKeyPrefix })
      toast.success(
        i18n.t('delete.bulkSuccess', {
          ns: 'audit-log',
          count: data.deletedCount,
        }),
      )
    },
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}

export function usePurgeAuditLogs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dryRun?: boolean) => purgeAuditLogs(dryRun),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditLogsQueryKeyPrefix })
      toast.success(i18n.t('purge.success', { ns: 'audit-log' }))
    },
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: exportAuditLogs,
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}
