import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AuditLogModuleSelect } from '@/features/audit-log/components/AuditLogModuleSelect'
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import { AuditLogConfigModuleSection } from '@/features/audit-log-config/components/AuditLogConfigModuleSection'
import { useAuditLogConfigAccess } from '@/features/audit-log-config/hooks/useAuditLogConfigAccess'
import {
  auditLogConfigQueryOptions,
  useUpdateAuditLogConfigToggles,
  useUpdateAuditLogSettings,
} from '@/features/audit-log-config/queries'
import type { AuditLogSettingsFormT } from '@/features/audit-log-config/schemas'
import { formatDate } from '@/lib/utils/date'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'

const routeApi = getRouteApi('/app/data-config/audit-log-config')

export function AuditLogConfigPage() {
  const { t } = useTranslation('audit-log-config')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const language = useCurrentLanguage()
  const { canConfig } = useAuditLogConfigAccess()
  const { data, isLoading } = useQuery(auditLogConfigQueryOptions())
  const toggleMutation = useUpdateAuditLogConfigToggles()
  const settingsMutation = useUpdateAuditLogSettings()
  const [settingsForm, setSettingsForm] = useState<AuditLogSettingsFormT>({
    retentionDays: 365,
    purgeEnabled: true,
  })

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm({
        retentionDays: data.settings.retentionDays,
        purgeEnabled: data.settings.purgeEnabled,
      })
    }
  }, [data?.settings])

  const filteredGroups = useMemo(() => {
    if (!data?.groups) return []
    if (!search.module) return data.groups
    return data.groups.filter((group) => group.module === search.module)
  }, [data?.groups, search.module])

  const updateSearch = (patch: { module?: string }) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
    })
  }

  if (!canConfig) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('errors.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <DataConfigSectionTabs active="audit-log-config" />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retention-days">{t('settings.retentionDays')}</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              max={3650}
              value={settingsForm.retentionDays}
              onChange={(event) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  retentionDays: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-foreground">{t('settings.purgeEnabled')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.purgeEnabledDescription')}
              </p>
            </div>
            <Switch
              checked={settingsForm.purgeEnabled}
              onCheckedChange={(purgeEnabled) =>
                setSettingsForm((prev) => ({ ...prev, purgeEnabled }))
              }
            />
          </div>
          {data?.settings.lastPurgeAt ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              {t('settings.lastPurgeAt', {
                date: formatDate(data.settings.lastPurgeAt, 'PP pp', language),
              })}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button
              onClick={() => settingsMutation.mutate(settingsForm)}
              disabled={settingsMutation.isPending}
            >
              {t('settings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-4">
            <div className="max-w-sm">
              <AuditLogModuleSelect
                id="audit-log-config-module"
                value={search.module ?? ''}
                onChange={(module) => updateSearch({ module: module || undefined })}
              />
            </div>
          </Card>

          {filteredGroups.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredGroups.map((group) => (
                <Card key={group.module} className="p-6">
                  <AuditLogConfigModuleSection
                    group={group}
                    disabled={toggleMutation.isPending}
                    onToggle={(item) => toggleMutation.mutate([item])}
                    onToggleAll={({ module, actionKeys, enabled }) =>
                      toggleMutation.mutate(
                        actionKeys.map((actionKey) => ({ module, actionKey, enabled })),
                      )
                    }
                  />
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('filter.empty')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
