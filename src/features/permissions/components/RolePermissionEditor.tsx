import { ChevronRight, Trash2, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  collectModuleKeysFromSubGroup,
  PERMISSION_HIERARCHY,
} from '@/features/permissions/lib/permissionHierarchy'
import {
  filterCatalogBySearch,
  hasFullAccess,
  isPermissionGranted,
  setPermissionGranted,
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
  onDeleteRole?: (role: PermissionRoleT) => void
  canManageRoles?: boolean
  isAdmin?: boolean
}

export function RolePermissionEditor({
  roles,
  catalog,
  rolePermissions,
  selectedRoleId,
  searchQuery = '',
  onSelectRole,
  onDeleteRole,
  onDeleteRole,
  canManageRoles = false,
  isAdmin = false,
}: RolePermissionEditorProps) {
  const { t } = useTranslation('permissions')
  const updatePermissions = useUpdateRolePermissions()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const filteredCatalog = useMemo(
    () => filterCatalogBySearch(catalog, searchQuery),
    [catalog, searchQuery],
  )

  const permissions = rolePermissions?.rules.permissions ?? []
  const restrictions = rolePermissions?.rules.restrictions ?? []
  const isFullAccess = hasFullAccess(permissions)

  const savePermissions = (
    nextPermissions: Array<string>,
    pendingId: string,
    nextHiddenModules?: Array<string>,
  ) => {
    if (!selectedRoleId) return

    setPendingKey(pendingId)
    updatePermissions.mutate(
      {
        roleId: selectedRoleId,
        permissions: nextPermissions,
        restrictions,
        hiddenModules: nextHiddenModules ?? rolePermissions?.hiddenModules,
      },
      {
        onSettled: () => setPendingKey(null),
      },
    )
  }

  const handleToggleHideModules = (moduleKeys: string[]) => {
    if (!selectedRoleId || moduleKeys.length === 0) return
    const currentHidden = rolePermissions?.hiddenModules ?? []
    
    // Check if all moduleKeys are currently hidden
    const isHidden = moduleKeys.every(m => currentHidden.includes(m))
    
    let nextHidden: string[]
    if (isHidden) {
      // Unhide: remove moduleKeys from hiddenModules
      nextHidden = currentHidden.filter(m => !moduleKeys.includes(m))
    } else {
      // Hide: add moduleKeys to hiddenModules
      nextHidden = [...new Set([...currentHidden, ...moduleKeys])]
    }
    
    savePermissions(permissions, `hide:${moduleKeys[0]}`, nextHidden)
  }

  const handleToggleItems = (
    items: PermissionCatalogItemT[],
    currentlyGranted: boolean,
    pendingId: string,
  ) => {
    if (!selectedRoleId || items.length === 0) return

    let nextPermissions = [...permissions]
    for (const item of items) {
      const isGranted = isPermissionGranted(nextPermissions, item.key, item.module)
      if (currentlyGranted && isGranted) {
        // Revoke
        const moduleKeys = catalog
          .filter((c) => c.module === item.module)
          .map((c) => c.key)
        nextPermissions = setPermissionGranted(
          nextPermissions,
          item.key,
          item.module,
          moduleKeys,
          false,
          catalog,
        )
      } else if (!currentlyGranted && !isGranted) {
        // Grant
        const moduleKeys = catalog
          .filter((c) => c.module === item.module)
          .map((c) => c.key)
        nextPermissions = setPermissionGranted(
          nextPermissions,
          item.key,
          item.module,
          moduleKeys,
          true,
          catalog,
        )
      }
    }

    savePermissions(nextPermissions, pendingId)
  }

  const handlePermissionToggle = (
    item: PermissionCatalogItemT,
    currentlyGranted: boolean,
  ) => {
    if (!selectedRoleId) return

    const moduleKeys = catalog
      .filter((c) => c.module === item.module)
      .map((c) => c.key)
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

  // Check state helper for a list of items
  const getItemListCheckState = (items: PermissionCatalogItemT[]) => {
    if (items.length === 0) return false
    const grantedCount = items.filter((item) =>
      isPermissionGranted(permissions, item.key, item.module),
    ).length
    if (grantedCount === 0) return false
    if (grantedCount === items.length) return true
    return 'indeterminate' as const
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border">
      {/* Sidebar: Role selection */}
      <section className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            {t('matrix.columns.role')}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {roles.map((role) => {
            const isSelected = role.id === selectedRoleId
            const canDelete =
              !role.isBaseRole && Boolean(onDeleteRole) && canManageRoles

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
                      ? 'text-accent-foreground font-semibold'
                      : 'text-foreground hover:bg-accent/50',
                  )}
                >
                  <span className="truncate">
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

      {/* Main panel: Hierarchical matrix */}
      <section className="flex min-w-0 flex-1 flex-col bg-card">
        <div className="shrink-0 border-b border-border px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">
              {t('matrix.columns.module')}
            </h2>
            {isFullAccess ? (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
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
          ) : filteredCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('matrix.emptyPermissions')}
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {PERMISSION_HIERARCHY.map((majorGroup) => {
                // Collect all items in this major group from filteredCatalog
                const majorModuleKeys = collectModuleKeysFromSubGroup({
                  id: majorGroup.id,
                  label: majorGroup.label,
                  modules: majorGroup.subModules.flatMap((s) =>
                    collectModuleKeysFromSubGroup(s),
                  ),
                })
                const majorItems = filteredCatalog.filter((item) =>
                  majorModuleKeys.includes(item.module),
                )

                if (majorItems.length === 0) return null

                const isCurrentRoleManaging = isPermissionGranted(permissions, 'roles.manage', 'roles')
                const showHideControls = isAdmin && isCurrentRoleManaging

                const majorCheckState = getItemListCheckState(majorItems)
                const isMajorFullyGranted = majorCheckState === true
                const isMajorPending = pendingKey === `major:${majorGroup.id}`
                const isMajorDisabled =
                  !canManageRoles || !selectedRoleId || isMajorPending

                return (
                  <div
                    key={majorGroup.id}
                    className={cn("rounded-lg border border-border bg-card shadow-sm transition-opacity", majorModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) && 'opacity-50')}
                  >
                    {/* Major Module Header */}
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
                      <label className="flex cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={
                            majorCheckState === 'indeterminate'
                              ? 'indeterminate'
                              : majorCheckState
                          }
                          disabled={isMajorDisabled}
                          onCheckedChange={() =>
                            handleToggleItems(
                              majorItems,
                              isMajorFullyGranted,
                              `major:${majorGroup.id}`,
                            )
                          }
                        />
                        <span className="text-base font-bold tracking-tight text-foreground">
                          {majorGroup.label}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          {majorItems.filter((i) =>
                            isPermissionGranted(permissions, i.key, i.module),
                          ).length}{' '}
                          / {majorItems.length} quyền được gán
                        </span>
                        {showHideControls && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn('size-7 hover:bg-transparent', majorModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? 'text-muted-foreground' : 'text-primary')}
                            onClick={(e) => { e.preventDefault(); handleToggleHideModules(majorModuleKeys); }}
                            title="Ẩn/Hiện nhóm quyền"
                          >
                            {majorModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Major Module Content: Sub-modules */}
                    <div className="flex flex-col divide-y divide-border p-5">
                      {majorGroup.subModules.map((sub) => {
                        const subModuleKeys = collectModuleKeysFromSubGroup(sub)
                        const subItems = filteredCatalog.filter((item) =>
                          subModuleKeys.includes(item.module),
                        )

                        if (subItems.length === 0) return null

                        const subCheckState = getItemListCheckState(subItems)
                        const isSubFullyGranted = subCheckState === true
                        const isSubPending = pendingKey === `sub:${sub.id}`
                        const isSubDisabled =
                          !canManageRoles || !selectedRoleId || isSubPending

                        // If sub has nested sub-groups (like Danh mục dùng chung, Cấu hình dữ liệu)
                        if (sub.groups && sub.groups.length > 0) {
                          return (
                            <div key={sub.id} className={cn("flex flex-col gap-4 py-5 first:pt-0 last:pb-0 transition-opacity", subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) && 'opacity-50')}>
                              <div className="flex items-center gap-3">
                                <label className="flex cursor-pointer items-center gap-2.5">
                                  <Checkbox
                                    checked={
                                      subCheckState === 'indeterminate'
                                        ? 'indeterminate'
                                        : subCheckState
                                    }
                                    disabled={isSubDisabled}
                                    onCheckedChange={() =>
                                      handleToggleItems(
                                        subItems,
                                        isSubFullyGranted,
                                        `sub:${sub.id}`,
                                      )
                                    }
                                  />
                                  <span className="text-sm font-bold text-foreground">
                                    {sub.label}
                                  </span>
                                </label>
                                {showHideControls && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn('size-6 hover:bg-transparent', subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? 'text-muted-foreground' : 'text-primary')}
                                    onClick={(e) => { e.preventDefault(); handleToggleHideModules(subModuleKeys); }}
                                    title="Ẩn/Hiện nhóm quyền"
                                  >
                                    {subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                  </Button>
                                )}
                              </div>

                              <div className="ml-7 flex flex-col gap-6 border-l border-border/80 pl-4">
                                {sub.groups.map((group) => {
                                  const groupItems = filteredCatalog.filter((item) =>
                                    group.modules.includes(item.module),
                                  )

                                  if (groupItems.length === 0) return null

                                  const groupCheckState = getItemListCheckState(groupItems)
                                  const isGroupFullyGranted = groupCheckState === true
                                  const isGroupPending = pendingKey === `group:${group.id}`
                                  const isGroupDisabled =
                                    !canManageRoles || !selectedRoleId || isGroupPending

                                  return (
                                    <div key={group.id} className={cn("flex flex-col gap-3 transition-opacity", group.modules.every(m => rolePermissions?.hiddenModules?.includes(m)) && 'opacity-50')}>
                                      <div className="flex items-center gap-3">
                                        <label className="flex cursor-pointer items-center gap-2">
                                          <Checkbox
                                            checked={
                                              groupCheckState === 'indeterminate'
                                                ? 'indeterminate'
                                                : groupCheckState
                                            }
                                            disabled={isGroupDisabled}
                                            onCheckedChange={() =>
                                              handleToggleItems(
                                                groupItems,
                                                isGroupFullyGranted,
                                                `group:${group.id}`,
                                              )
                                            }
                                          />
                                          <span className="text-sm font-semibold text-foreground/90">
                                            {group.label}
                                          </span>
                                        </label>
                                        {showHideControls && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={cn('size-6 hover:bg-transparent', group.modules.every(m => rolePermissions?.hiddenModules?.includes(m)) ? 'text-muted-foreground' : 'text-primary')}
                                            onClick={(e) => { e.preventDefault(); handleToggleHideModules(group.modules); }}
                                            title="Ẩn/Hiện nhóm quyền"
                                          >
                                            {group.modules.every(m => rolePermissions?.hiddenModules?.includes(m)) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                          </Button>
                                        )}
                                      </div>

                                      <div className="ml-6">
                                        <PermissionGrid
                                          items={groupItems}
                                          permissions={permissions}
                                          pendingKey={pendingKey}
                                          canManageRoles={canManageRoles}
                                          onToggle={handlePermissionToggle}
                                        />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }

                        // Direct sub-module (no sub-groups)
                        return (
                          <div key={sub.id} className={cn("flex flex-col gap-3 py-5 first:pt-0 last:pb-0 transition-opacity", subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) && 'opacity-50')}>
                            <div className="flex items-center gap-3">
                              <label className="flex cursor-pointer items-center gap-2.5">
                                <Checkbox
                                  checked={
                                    subCheckState === 'indeterminate'
                                      ? 'indeterminate'
                                      : subCheckState
                                  }
                                  disabled={isSubDisabled}
                                  onCheckedChange={() =>
                                    handleToggleItems(
                                      subItems,
                                      isSubFullyGranted,
                                      `sub:${sub.id}`,
                                    )
                                  }
                                />
                                <span className="text-sm font-bold text-foreground">
                                  {sub.label}
                                </span>
                              </label>
                              {showHideControls && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn('size-6 hover:bg-transparent', subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? 'text-muted-foreground' : 'text-primary')}
                                    onClick={(e) => { e.preventDefault(); handleToggleHideModules(subModuleKeys); }}
                                    title="Ẩn/Hiện nhóm quyền"
                                  >
                                    {subModuleKeys.every(m => rolePermissions?.hiddenModules?.includes(m)) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                  </Button>
                              )}
                            </div>

                            <div className="ml-7 border-l border-border/80 pl-4">
                              <PermissionGrid
                                items={subItems}
                                permissions={permissions}
                                pendingKey={pendingKey}
                                canManageRoles={canManageRoles}
                                onToggle={handlePermissionToggle}
                              />
                            </div>
                          </div>
                        )
                      })}
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

function PermissionGrid({
  items,
  permissions,
  pendingKey,
  canManageRoles,
  onToggle,
}: {
  items: PermissionCatalogItemT[]
  permissions: string[]
  pendingKey: string | null
  canManageRoles: boolean
  onToggle: (item: PermissionCatalogItemT, currentlyGranted: boolean) => void
}) {
  // Split into 2-column pairs
  const rows: Array<Array<PermissionCatalogItemT>> = []
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2))
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {row.map((item) => {
            const granted = isPermissionGranted(permissions, item.key, item.module)
            const isPending = pendingKey === `permission:${item.key}`
            const disabled = !canManageRoles || isPending

            return (
              <label
                key={item.key}
                className={cn(
                  'flex items-start gap-3 rounded-md p-2 hover:bg-muted/40 transition-colors',
                  disabled ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <Checkbox
                  checked={granted}
                  disabled={disabled}
                  onCheckedChange={() => onToggle(item, granted)}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium leading-tight text-foreground block">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs leading-normal text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function PermissionMatrixLegend() {
  return null
}
