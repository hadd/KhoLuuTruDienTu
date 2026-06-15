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
  const {
    useMetadataPermissionConfig,
    metadataTemplateId,
    metadataPermissionConfigId,
  } = useGroupConfig(groupId)

  const {
    data: metadataConfigs = [],
    isLoading: isLoadingMetadataConfigs,
  } = useQuery(metadataPermissionConfigsQueryOptions())
  const { mutate: assignMetadataPermissionConfig } =
    useAssignGroupMetadataPermissionConfig()

  const templateOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()

    if (permissionConfig?.template) {
      map.set(permissionConfig.template.id, permissionConfig.template)
    }

    for (const config of metadataConfigs) {
      if (!map.has(config.templateId)) {
        map.set(config.templateId, config.template)
      }
    }

    return Array.from(map.values())
  }, [metadataConfigs, permissionConfig?.template])

  const selectedMetadataTemplateId =
    metadataTemplateId &&
    templateOptions.some((item) => item.id === metadataTemplateId)
      ? metadataTemplateId
      : templateOptions[0]?.id

  const filteredConfigs = useMemo(() => {
    const configs = selectedMetadataTemplateId
      ? metadataConfigs.filter(
          (config) => config.templateId === selectedMetadataTemplateId,
        )
      : []

    if (
      permissionConfig &&
      selectedMetadataTemplateId === permissionConfig.templateId &&
      !configs.some((item) => item.id === permissionConfig.id)
    ) {
      return [
        {
          id: permissionConfig.id,
          name: permissionConfig.name,
          description: '',
          templateId: permissionConfig.templateId,
          status: 'ready',
          createdAt: '',
          updatedAt: '',
          slotCount: permissionConfig.slots.length,
          template: permissionConfig.template ?? {
            id: permissionConfig.templateId,
            name: permissionConfig.templateId,
          },
        },
        ...configs,
      ]
    }

    return configs
  }, [metadataConfigs, permissionConfig, selectedMetadataTemplateId])

  const selectedMetadataConfigId =
    metadataPermissionConfigId &&
    filteredConfigs.some((item) => item.id === metadataPermissionConfigId)
      ? metadataPermissionConfigId
      : filteredConfigs[0]?.id

  const handleAssignMetadataPermissionConfig = (permissionConfigId: string) => {
    groupConfigStore.setGroupMetadataPermissionConfig(groupId, permissionConfigId)

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

    if (permissionConfig?.templateId && !metadataTemplateId) {
      groupConfigStore.setGroupMetadataTemplate(groupId, permissionConfig.templateId)
    }

    if (permissionConfig?.id && !metadataPermissionConfigId) {
      handleAssignMetadataPermissionConfig(permissionConfig.id)
      return
    }

    if (templateOptions.length === 0) return

    if (!metadataTemplateId) {
      groupConfigStore.setGroupMetadataTemplate(groupId, templateOptions[0].id)
      return
    }

    if (!metadataPermissionConfigId && filteredConfigs[0]) {
      handleAssignMetadataPermissionConfig(filteredConfigs[0].id)
    }
  }, [
    filteredConfigs,
    groupId,
    metadataPermissionConfigId,
    metadataTemplateId,
    permissionConfig?.id,
    permissionConfig?.templateId,
    templateOptions,
    useMetadataPermissionConfig,
    serverMetadataPermissionConfigId,
  ])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[200px] flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('configTemplate.label')}</Label>
        <label
          htmlFor={`metadata-permission-mode-${groupId}`}
          className={cn(
            'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors',
            useMetadataPermissionConfig
              ? 'border-primary bg-muted'
              : 'border-border hover:bg-accent',
          )}
        >
          <input
            id={`metadata-permission-mode-${groupId}`}
            type="radio"
            name={`config-template-mode-${groupId}`}
            checked={useMetadataPermissionConfig}
            onClick={() =>
              groupConfigStore.setGroupMetadataPermissionMode(
                groupId,
                !useMetadataPermissionConfig,
              )
            }
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
              disabled={isLoadingMetadataConfigs || templateOptions.length === 0}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue
                  placeholder={t('configTemplate.fields.nameTemplate.placeholder')}
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
                isLoadingMetadataConfigs ||
                !selectedMetadataTemplateId ||
                filteredConfigs.length === 0
              }
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue
                  placeholder={t('configTemplate.fields.configuration.placeholder')}
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
