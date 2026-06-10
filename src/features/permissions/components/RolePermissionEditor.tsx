import { useMemo, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  filterCatalogBySearch,
  getModuleCheckState,
  getModuleKeys,
  groupCatalogByModule,
  hasFullAccess,
  isModuleFullyGranted,
  isPermissionGranted,
  setModuleGranted,
  setPermissionGranted,
} from '@/features/permissions/lib/permissionRules'
import { useUpdateRolePermissions } from '@/features/permissions/queries'
import type {
  PermissionCatalogItemT,
  PermissionRoleT,
  RolePermissionsRecordT,
} from '@/features/permissions/types'
import { getModuleLabel } from '@/features/permissions/lib/moduleLabels'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import { cn } from '@/lib/utils/cn'

interface RolePermissionEditorProps {
  roles: Array<PermissionRoleT>
  catalog: Array<PermissionCatalogItemT>
  rolePermissions?: RolePermissionsRecordT
  selectedRoleId?: string
  selectedModule?: string
  searchQuery?: string
  onSelectRole: (roleId: string) => void
  onSelectModule: (module: string | undefined) => void
  onDeleteRole?: (role: PermissionRoleT) => void
}

export function RolePermissionEditor({
  roles,
  catalog,
  rolePermissions,
  selectedRoleId,
  selectedModule,
  searchQuery = '',
  onSelectRole,
  onSelectModule,
  onDeleteRole,
}: RolePermissionEditorProps) {
  const { t } = useTranslation('permissions')
  const updatePermissions = useUpdateRolePermissions()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const filteredCatalog = useMemo(
    () => filterCatalogBySearch(catalog, searchQuery),
    [catalog, searchQuery],
  )

  const modulesMap = useMemo(
    () => groupCatalogByModule(filteredCatalog),
    [filteredCatalog],
  )

  const modules = useMemo(
    () => Array.from(modulesMap.keys()).sort(),
    [modulesMap],
  )

  const permissions = rolePermissions?.rules.permissions ?? []
  const restrictions = rolePermissions?.rules.restrictions ?? []
  const isFullAccess = hasFullAccess(permissions)

  const selectedModuleItems = selectedModule
    ? (modulesMap.get(selectedModule) ?? [])
    : []

  const selectedModuleKeys = useMemo(
    () => selectedModuleItems.map((item) => item.key),
    [selectedModuleItems],
  )

  const selectedModuleCheckState = selectedModule
    ? getModuleCheckState(permissions, selectedModule, selectedModuleKeys)
    : false

  const isSelectedModuleFullyGranted = selectedModule
    ? isModuleFullyGranted(permissions, selectedModule, selectedModuleKeys)
    : false

  const savePermissions = (
    nextPermissions: Array<string>,
    pendingId: string,
  ) => {
    if (!selectedRoleId) return

    setPendingKey(pendingId)
    updatePermissions.mutate(
      {
        roleId: selectedRoleId,
        permissions: nextPermissions,
        restrictions,
      },
      {
        onSettled: () => setPendingKey(null),
      },
    )
  }

  const handleModuleToggle = (module: string, currentlyGranted: boolean) => {
    const moduleKeys = getModuleKeys(catalog, module)
    const nextPermissions = setModuleGranted(
      permissions,
      module,
      moduleKeys,
      !currentlyGranted,
      catalog,
    )
    savePermissions(nextPermissions, `module:${module}`)
  }

  const handlePermissionToggle = (
    item: PermissionCatalogItemT,
    currentlyGranted: boolean,
  ) => {
    const moduleKeys = getModuleKeys(catalog, item.module)
    const nextPermissions = setPermissionGranted(
      permissions,
      item.key,
      item.module,
      moduleKeys,
      !currentlyGranted,
      catalog,
    )
    savePermissions(nextPermissions, `permission:${item.key}`)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border">
      <section className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            {t('matrix.columns.role')}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {roles.map((role) => {
            const isSelected = role.id === selectedRoleId
            const canDelete = !role.isBaseRole && Boolean(onDeleteRole)

            return (
              <div
                key={role.id}
                className={cn(
                  'flex items-center gap-1 rounded-md',
                  isSelected && 'bg-accent',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectRole(role.id)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50',
                  )}
                >
                  <span className="truncate font-medium">
                    {getRoleLabel(role.id, role.name) ?? role.name}
                  </span>
                  {isSelected ? (
                    <ChevronRight className="size-4 shrink-0" />
                  ) : null}
                </button>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t('roles.actions.delete', { name: role.name })}
                    onClick={() => onDeleteRole?.(role)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            {t('matrix.columns.module')}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!selectedRoleId ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {t('matrix.selectRoleHint')}
            </p>
          ) : modules.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {t('matrix.emptyPermissions')}
            </p>
          ) : (
            modules.map((module) => {
              const moduleItems = modulesMap.get(module) ?? []
              const moduleKeys = moduleItems.map((item) => item.key)
              const isSelected = module === selectedModule
              const checkState = getModuleCheckState(
                permissions,
                module,
                moduleKeys,
              )
              const isFullyGranted = isModuleFullyGranted(
                permissions,
                module,
                moduleKeys,
              )
              const isPending = pendingKey === `module:${module}`

              return (
                <div
                  key={module}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-2',
                    isSelected && 'bg-accent/50',
                  )}
                >
                  <Checkbox
                    checked={
                      checkState === 'indeterminate'
                        ? 'indeterminate'
                        : checkState
                    }
                    disabled={!selectedRoleId || isPending}
                    onCheckedChange={() =>
                      handleModuleToggle(module, isFullyGranted)
                    }
                    aria-label={t('matrix.toggleModule', {
                      role: rolePermissions?.roleName ?? '',
                      module: getModuleLabel(module),
                    })}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectModule(module)}
                    className="flex min-w-0 flex-1 items-center justify-between text-left text-sm text-foreground"
                  >
                    <span className="truncate font-medium">
                      {getModuleLabel(module)}
                    </span>
                    <ChevronRight
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground',
                        isSelected && 'text-foreground',
                      )}
                    />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">
              {t('matrix.columns.permission')}
            </h2>
            {isFullAccess ? (
              <span className="text-xs text-muted-foreground">
                {t('matrix.fullAccessBadge')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!selectedRoleId ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.selectRoleHint')}
            </p>
          ) : !selectedModule ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.selectModuleHint')}
            </p>
          ) : selectedModuleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.emptyPermissions')}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/40">
                <Checkbox
                  checked={
                    selectedModuleCheckState === 'indeterminate'
                      ? 'indeterminate'
                      : selectedModuleCheckState
                  }
                  disabled={
                    pendingKey === `module:${selectedModule}` || isFullAccess
                  }
                  onCheckedChange={() =>
                    handleModuleToggle(
                      selectedModule,
                      isSelectedModuleFullyGranted,
                    )
                  }
                  aria-label={t('matrix.toggleModule', {
                    role: rolePermissions?.roleName ?? '',
                    module: getModuleLabel(selectedModule),
                  })}
                />
                <span className="text-sm font-medium text-foreground">
                  {t('matrix.selectAllPermissions')}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {selectedModuleItems.map((item) => {
                  const granted = isPermissionGranted(
                    permissions,
                    item.key,
                    item.module,
                  )
                  const isPending = pendingKey === `permission:${item.key}`

                  return (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={granted}
                        disabled={isPending || isFullAccess}
                        onCheckedChange={() =>
                          handlePermissionToggle(item, granted)
                        }
                        aria-label={t('matrix.toggleGrant', {
                          role: rolePermissions?.roleName ?? '',
                          permission: item.label,
                        })}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        {item.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function PermissionMatrixLegend() {
  return null
}
