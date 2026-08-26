import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { AuditLogModuleSelect } from '@/features/audit-log/components/AuditLogModuleSelect'
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import { AuditLogConfigModuleSection } from '@/features/audit-log-config/components/AuditLogConfigModuleSection'
import { useAuditLogConfigAccess } from '@/features/audit-log-config/hooks/useAuditLogConfigAccess'
import {
  auditLogConfigQueryOptions,
  useUpdateAuditLogConfigToggles,
} from '@/features/audit-log-config/queries'

const routeApi = getRouteApi('/app/data-config/audit-log-config')

export function AuditLogConfigPage() {
  const { t } = useTranslation('audit-log-config')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { canConfig } = useAuditLogConfigAccess()
  const { data, isLoading } = useQuery(auditLogConfigQueryOptions())
  const toggleMutation = useUpdateAuditLogConfigToggles()

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DataConfigSectionTabs active="audit-log-config" />

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
                allowedModules={data?.groups.map((group) => group.module)}
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
