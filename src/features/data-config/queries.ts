import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createPermissionConfig,
  deletePermissionConfig,
  getPermissionConfig,
  getPermissionConfigs,
  getPermissionTemplateOptions,
  updatePermissionConfigSlots,
} from '@/features/data-config/api/metadataPermissionConfigClient'
import {
  createMetadataTemplate,
  getMetadataTemplateById,
  getMetadataTemplateDossierOptions,
  getMetadataTemplates,
  updateMetadataTemplate,
} from '@/features/data-config/api/metadataTemplateClient'
import { mapMetadataTemplateToDocumentType } from '@/features/data-config/lib/metadataTemplateHelpers'
import type {
  CreateMetadataPermissionConfigPayloadT,
  CreateMetadataTemplatePayloadT,
  UpdateMetadataPermissionConfigSlotsPayloadT,
  UpdateMetadataTemplatePayloadT,
} from '@/features/data-config/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const metadataTemplatesQueryKey = ['admin', 'metadata-templates'] as const

export const metadataTemplateDossierOptionsQueryKey = [
  'admin',
  'metadata-templates',
  'dossier-options',
] as const

export const permissionTemplateOptionsQueryKey = [
  'admin',
  'metadata-permission-configs',
  'template-options',
] as const

export const permissionConfigsQueryKey = [
  'admin',
  'metadata-permission-configs',
] as const

export const permissionConfigQueryKey = (configId: string) =>
  ['admin', 'metadata-permission-configs', configId] as const

export const metadataTemplateDetailQueryKey = (templateId: string) =>
  ['admin', 'metadata-templates', templateId] as const

export const metadataTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: metadataTemplatesQueryKey,
    queryFn: async () => {
      const templates = await getMetadataTemplates()
      return templates.map(mapMetadataTemplateToDocumentType)
    },
    staleTime: 60_000,
  })

export const metadataTemplateDossierOptionsQueryOptions = () =>
  queryOptions({
    queryKey: metadataTemplateDossierOptionsQueryKey,
    queryFn: getMetadataTemplateDossierOptions,
    staleTime: 60_000,
  })

export const metadataTemplateDetailQueryOptions = (templateId: string) =>
  queryOptions({
    queryKey: metadataTemplateDetailQueryKey(templateId),
    queryFn: () => getMetadataTemplateById(templateId),
    enabled: Boolean(templateId),
    staleTime: 60_000,
  })

export const permissionTemplateOptionsQueryOptions = () =>
  queryOptions({
    queryKey: permissionTemplateOptionsQueryKey,
    queryFn: getPermissionTemplateOptions,
    staleTime: 60_000,
  })

export const permissionConfigsQueryOptions = () =>
  queryOptions({
    queryKey: permissionConfigsQueryKey,
    queryFn: getPermissionConfigs,
    staleTime: 60_000,
  })

export const permissionConfigQueryOptions = (configId: string) =>
  queryOptions({
    queryKey: permissionConfigQueryKey(configId),
    queryFn: () => getPermissionConfig(configId),
    enabled: Boolean(configId),
    staleTime: 30_000,
  })

export const useCreateMetadataTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateMetadataTemplatePayloadT) =>
      createMetadataTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metadataTemplatesQueryKey })
      toast.success(
        i18n.t('documentTypes.picker.success', { ns: 'data-config' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useUpdateMetadataTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string
      payload: UpdateMetadataTemplatePayloadT
    }) => updateMetadataTemplate(templateId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: metadataTemplatesQueryKey })
      void queryClient.invalidateQueries({
        queryKey: metadataTemplateDetailQueryKey(data.id),
      })
      void queryClient.invalidateQueries({
        queryKey: permissionTemplateOptionsQueryKey,
      })
      toast.success(
        i18n.t('documentTypes.edit.success', { ns: 'data-config' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useCreatePermissionConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateMetadataPermissionConfigPayloadT) =>
      createPermissionConfig(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: permissionConfigsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: permissionConfigQueryKey(data.id),
      })
      toast.success(
        i18n.t('documentAssignment.subTemplates.createSuccess', {
          ns: 'data-config',
        }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useUpdatePermissionConfigSlots = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      configId,
      payload,
    }: {
      configId: string
      payload: UpdateMetadataPermissionConfigSlotsPayloadT
    }) => updatePermissionConfigSlots(configId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: permissionConfigsQueryKey })
      void queryClient.invalidateQueries({
        queryKey: permissionConfigQueryKey(data.id),
      })
      toast.success(
        i18n.t('documentAssignment.saveSlotsSuccess', { ns: 'data-config' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useDeletePermissionConfig = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (configId: string) => deletePermissionConfig(configId),
    onSuccess: (_data, configId) => {
      void queryClient.invalidateQueries({ queryKey: permissionConfigsQueryKey })
      void queryClient.removeQueries({
        queryKey: permissionConfigQueryKey(configId),
      })
      toast.success(
        i18n.t('delete.subTemplateSuccess', { ns: 'data-config' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}
