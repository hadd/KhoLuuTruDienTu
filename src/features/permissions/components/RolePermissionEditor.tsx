import { ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getModuleLabelFromCatalog } from '@/features/permissions/lib/moduleLabels'
import {
  ensureLockedPermissionsIncluded,
  filterCatalogBySearch,
  getModuleCheckState,
  getModuleKeys,
  groupCatalogByModule,
  hasFullAccess,
  isModuleFullyGranted,
  isModuleRevokeDisabled,
  isPermissionGranted,
  isPermissionLocked,
  setModuleGrantedRespectingLocks,
  setPermissionGrantedRespectingLocks,
  sortModulesForDisplay,
} from '@/features/permissions/lib/permissionRules'
import { useUpdateRolePermissions } from '@/features/permissions/queries'
import type {
  PermissionCatalogItemT,
  PermissionRoleT,
  RolePermissionsRecordT,
} from '@/features/permissions/types'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import { cn } from '@/lib/utils/cn'

interface RolePermissionEditorProps {
  roles: Array<PermissionRoleT>
  catalog: Array<PermissionCatalogItemT>
  rolePermissions?: RolePermissionsRecordT
  selectedRoleId?: string
  searchQuery?: string
  onSelectRole: (roleId: string) => void
  onDeleteRole?: (role: PermissionRoleT) => void
  canManageRoles?: boolean
}

export function RolePermissionEditor({
  roles,
  catalog,
  rolePermissions,
  selectedRoleId,
  searchQuery = '',
  onSelectRole,
  onDeleteRole,
  canManageRoles = false,
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
    () => sortModulesForDisplay(Array.from(modulesMap.keys())),
    [modulesMap],
  )

  const permissions = rolePermissions?.rules.permissions ?? []
  const restrictions = rolePermissions?.rules.restrictions ?? []
  const isFullAccess = hasFullAccess(permissions)

  const permissionRowsByModule = useMemo(() => {
    const rowsMap = new Map<string, Array<Array<PermissionCatalogItemT>>>()

    for (const module of modules) {
      const moduleItems = modulesMap.get(module) ?? []
      const rows: Array<Array<PermissionCatalogItemT>> = []

      for (let index = 0; index < moduleItems.length; index += 2) {
        rows.push(moduleItems.slice(index, index + 2))
      }

      rowsMap.set(module, rows)
    }

    return rowsMap
  }, [modules, modulesMap])

  const savePermissions = (
    nextPermissions: Array<string>,
    pendingId: string,
  ) => {
    if (!selectedRoleId) return

    const safePermissions = ensureLockedPermissionsIncluded(
      selectedRoleId,
      nextPermissions,
    )

    setPendingKey(pendingId)
    updatePermissions.mutate(
      {
        roleId: selectedRoleId,
        permissions: safePermissions,
        restrictions,
      },
      {
        onSettled: () => setPendingKey(null),
      },
    )
  }

  const handleModuleToggle = (module: string, currentlyGranted: boolean) => {
    if (!selectedRoleId) return

    const moduleKeys = getModuleKeys(catalog, module)
    const nextPermissions = setModuleGrantedRespectingLocks(
      selectedRoleId,
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
    if (!selectedRoleId) return

    const moduleKeys = getModuleKeys(catalog, item.module)
    const nextPermissions = setPermissionGrantedRespectingLocks(
      selectedRoleId,
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
            const canDelete = !role.isBaseRole && Boolean(onDeleteRole) && canManageRoles

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

      <section className="flex min-w-0 flex-1 flex-col bg-card">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">
              {t('matrix.columns.module')}
            </h2>
            {isFullAccess ? (
              <span className="text-xs text-muted-foreground">
                {t('matrix.fullAccessBadge')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!selectedRoleId ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.selectRoleHint')}
            </p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.emptyPermissions')}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {modules.map((module) => {
                const moduleItems = modulesMap.get(module) ?? []
                const moduleKeys = moduleItems.map((item) => item.key)
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
                const isModulePending = pendingKey === `module:${module}`
                const isModuleToggleDisabled =
                  !canManageRoles ||
                  !selectedRoleId ||
                  isModulePending ||
                  (isFullyGranted &&
                    isModuleRevokeDisabled(
                      selectedRoleId,
                      permissions,
                      module,
                      moduleKeys,
                    ))
                const permissionRows = permissionRowsByModule.get(module) ?? []

                return (
                  <div
                    key={module}
                    className="flex flex-col gap-4 py-6 first:pt-0 last:pb-0"
                  >
                    <label className="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-3">
                      <Checkbox
                        checked={
                          checkState === 'indeterminate'
                            ? 'indeterminate'
                            : checkState
                        }
                        disabled={isModuleToggleDisabled}
                        onCheckedChange={() =>
                          handleModuleToggle(module, isFullyGranted)
                        }
                        aria-label={t('matrix.toggleModule', {
                          role: rolePermissions?.roleName ?? '',
                          module: getModuleLabelFromCatalog(catalog, module),
                        })}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {getModuleLabelFromCatalog(catalog, module)}
                      </span>
                    </label>

                    <div className="flex flex-col gap-5 pl-8">
                      {permissionRows.map((row, rowIndex) => (
                        <div
                          key={`${module}-row-${rowIndex}`}
                          className="grid grid-cols-2 gap-x-16"
                        >
                          {row.map((item) => {
                            const granted = isPermissionGranted(
                              permissions,
                              item.key,
                              item.module,
                            )
                            const isPending =
                              pendingKey === `permission:${item.key}`
                            const isLocked =
                              Boolean(selectedRoleId) &&
                              isPermissionLocked(selectedRoleId, item.key)
                            const isCheckboxDisabled =
                              !canManageRoles || isPending || (granted && isLocked)

                            return (
                              <label
                                key={item.key}
                                className={cn(
                                  'grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3',
                                  isCheckboxDisabled
                                    ? 'cursor-default'
                                    : 'cursor-pointer',
                                )}
                              >
                                <Checkbox
                                  checked={granted}
                                  disabled={isCheckboxDisabled}
                                  onCheckedChange={() =>
                                    handlePermissionToggle(item, granted)
                                  }
                                  aria-label={t('matrix.toggleGrant', {
                                    role: rolePermissions?.roleName ?? '',
                                    permission: item.label,
                                  })}
                                  className="mt-0.5"
                                />
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-medium leading-5 text-foreground">
                                      {item.label}
                                    </span>
                                    {isLocked ? (
                                      <span
                                        className="text-xs text-muted-foreground"
                                        title={t('matrix.lockedPermissionHint')}
                                      >
                                        {t('matrix.lockedPermission')}
                                      </span>
                                    ) : null}
                                  </span>
                                  {item.description ? (
                                    <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                                      {item.description}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            )
                          })}
                          {row.length === 1 ? <div aria-hidden="true" /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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
