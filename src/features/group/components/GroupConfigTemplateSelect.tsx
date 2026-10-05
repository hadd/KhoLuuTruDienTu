import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { permissionTemplateOptionsQueryOptions } from '@/features/data-config/queries'
import { useGroupAccess } from '@/features/group/hooks/useGroupAccess'
import {
  metadataPermissionConfigsQueryOptions,
  useAssignGroupMetadataPermissionConfig,
} from '@/features/group/queries'
import { groupConfigStore, useGroupConfig } from '@/features/group/store'
import type { GroupPermissionConfigSummaryT } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

interface GroupConfigTemplateSelectProps {
  groupId: string
  permissionConfig?: GroupPermissionConfigSummaryT | null
  serverMetadataPermissionConfigId?: string | null
}

export function GroupConfigTemplateSelect({
  groupId,
  permissionConfig,
  serverMetadataPermissionConfigId,
}: GroupConfigTemplateSelectProps) {
  const { t } = useTranslation('group')
  const { canUpdateGroup } = useGroupAccess()
  const {
    useMetadataPermissionConfig,
    metadataTemplateId,
    metadataPermissionConfigId,
  } = useGroupConfig(groupId)

  const {
    data: templateOptionsFromApi = [],
    isLoading: isLoadingTemplateOptions,
  } = useQuery(permissionTemplateOptionsQueryOptions())
  const { data: metadataConfigs = [], isLoading: isLoadingMetadataConfigs } =
    useQuery(metadataPermissionConfigsQueryOptions())
  const { mutate: assignMetadataPermissionConfig } =
    useAssignGroupMetadataPermissionConfig()

  const permTemplateId = permissionConfig?.template?.id
  const permTemplateName = permissionConfig?.template?.name
  const templateOptions = useMemo(() => {
    const map = new Map(
      templateOptionsFromApi.map((template) => [template.id, template]),
    )

    if (permTemplateId && !map.has(permTemplateId)) {
      map.set(permTemplateId, {
        id: permTemplateId,
        name: permTemplateName || permTemplateId,
        updatedAt: '',
      })
    }

    return Array.from(map.values())
  }, [permTemplateId, permTemplateName, templateOptionsFromApi])

  const selectedMetadataTemplateId =
    metadataTemplateId &&
    templateOptions.some((item) => item.id === metadataTemplateId)
      ? metadataTemplateId
      : templateOptions[0]?.id

  const permConfigId = permissionConfig?.id
  const permConfigTemplateId = permissionConfig?.templateId
  const permConfigName = permissionConfig?.name
  const permConfigSlotsCount = permissionConfig?.slots?.length ?? 0

  const filteredConfigs = useMemo(() => {
    const configs = selectedMetadataTemplateId
      ? metadataConfigs.filter(
          (config) => config.templateId === selectedMetadataTemplateId,
        )
      : []

    if (
      permConfigId &&
      selectedMetadataTemplateId === permConfigTemplateId &&
      !configs.some((item) => item.id === permConfigId)
    ) {
      return [
        {
          id: permConfigId,
          name: permConfigName || permConfigId,
          description: '',
          templateId: permConfigTemplateId,
          status: 'ready' as const,
          createdAt: '',
          updatedAt: '',
          slotCount: permConfigSlotsCount,
          template: {
            id: permConfigTemplateId,
            name: permTemplateName || permConfigTemplateId,
          },
        },
        ...configs,
      ]
    }

    return configs
  }, [
    metadataConfigs,
    permConfigId,
    permConfigTemplateId,
    permConfigName,
    permConfigSlotsCount,
    permTemplateName,
    selectedMetadataTemplateId,
  ])

  const selectedMetadataConfigId =
    metadataPermissionConfigId &&
    filteredConfigs.some((item) => item.id === metadataPermissionConfigId)
      ? metadataPermissionConfigId
      : filteredConfigs[0]?.id

  const handleAssignMetadataPermissionConfig = (permissionConfigId: string) => {
    groupConfigStore.setGroupMetadataPermissionConfig(
      groupId,
      permissionConfigId,
    )

    if (serverMetadataPermissionConfigId === permissionConfigId) return

    assignMetadataPermissionConfig({ groupId, permissionConfigId })
  }

  const handleSelectMetadataTemplate = (nextTemplateId: string) => {
    groupConfigStore.setGroupMetadataTemplate(groupId, nextTemplateId)

    const nextConfigs = metadataConfigs.filter(
      (config) => config.templateId === nextTemplateId,
    )

    if (nextConfigs[0]) {
      handleAssignMetadataPermissionConfig(nextConfigs[0].id)
    }
  }

  useEffect(() => {
    if (!useMetadataPermissionConfig) return

    if (permConfigTemplateId && !metadataTemplateId) {
      groupConfigStore.setGroupMetadataTemplate(groupId, permConfigTemplateId)
    }

    if (permConfigId && !metadataPermissionConfigId) {
      groupConfigStore.setGroupMetadataPermissionConfig(groupId, permConfigId)
      return
    }

    if (templateOptions.length === 0) return

    if (!metadataTemplateId && templateOptions[0]) {
      groupConfigStore.setGroupMetadataTemplate(groupId, templateOptions[0].id)
      return
    }

    if (!metadataPermissionConfigId && filteredConfigs[0]) {
      groupConfigStore.setGroupMetadataPermissionConfig(
        groupId,
        filteredConfigs[0].id,
      )
    }
  }, [
    filteredConfigs,
    groupId,
    metadataPermissionConfigId,
    metadataTemplateId,
    permConfigId,
    permConfigTemplateId,
    templateOptions,
    useMetadataPermissionConfig,
  ])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[200px] flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          {t('configTemplate.label')}
        </Label>
        <label
          htmlFor={`metadata-permission-mode-${groupId}`}
          className={cn(
            'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors',
            useMetadataPermissionConfig
              ? 'border-primary bg-muted'
              : 'border-border hover:bg-accent',
            !canUpdateGroup && 'pointer-events-none opacity-60',
          )}
        >
          <input
            id={`metadata-permission-mode-${groupId}`}
            type="radio"
            name={`config-template-mode-${groupId}`}
            checked={useMetadataPermissionConfig}
            disabled={!canUpdateGroup}
            onClick={() => {
              if (!canUpdateGroup) return
              const nextEnabled = !useMetadataPermissionConfig
              groupConfigStore.setGroupMetadataPermissionMode(
                groupId,
                nextEnabled,
              )

              if (!nextEnabled) {
                assignMetadataPermissionConfig({
                  groupId,
                  permissionConfigId: null,
                })
              }
            }}
            onChange={() => undefined}
            className="size-4 shrink-0 accent-primary"
          />
          <span className="truncate text-sm text-foreground">
            {t('configTemplate.metadataPermissionMode')}
          </span>
        </label>
      </div>

      {useMetadataPermissionConfig ? (
        <>
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('configTemplate.fields.nameTemplate.label')}
            </Label>
            <Select
              value={selectedMetadataTemplateId}
              onValueChange={handleSelectMetadataTemplate}
              disabled={
                !canUpdateGroup ||
                isLoadingTemplateOptions ||
                templateOptions.length === 0
              }
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue
                  placeholder={t(
                    'configTemplate.fields.nameTemplate.placeholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('configTemplate.fields.configuration.label')}
            </Label>
            <Select
              value={selectedMetadataConfigId}
              onValueChange={handleAssignMetadataPermissionConfig}
              disabled={
                !canUpdateGroup ||
                isLoadingMetadataConfigs ||
                !selectedMetadataTemplateId ||
                filteredConfigs.length === 0
              }
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue
                  placeholder={t(
                    'configTemplate.fields.configuration.placeholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
    </div>
  )
}
