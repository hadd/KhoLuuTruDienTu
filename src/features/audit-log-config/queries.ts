import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getAuditLogConfig,
  updateAuditLogConfigToggles,
  updateAuditLogSettings,
} from '@/features/audit-log-config/api/auditLogConfigClient'
import type { AuditLogSettingsFormT } from '@/features/audit-log-config/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const auditLogConfigQueryKey = ['admin', 'audit-log-config'] as const

export const auditLogConfigQueryOptions = () =>
  queryOptions({
    queryKey: auditLogConfigQueryKey,
    queryFn: getAuditLogConfig,
    staleTime: 30_000,
  })

export function useUpdateAuditLogConfigToggles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAuditLogConfigToggles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditLogConfigQueryKey })
      toast.success(i18n.t('form.success.update', { ns: 'audit-log-config' }))
    },
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateAuditLogSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AuditLogSettingsFormT) => updateAuditLogSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditLogConfigQueryKey })
      toast.success(i18n.t('settings.success', { ns: 'audit-log-config' }))
    },
    onError: (error: Error) => {
      toast.error(translateError(error))
    },
  })
}
