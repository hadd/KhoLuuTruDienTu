import { ChevronRight, ChevronDown, Trash2, Eye, EyeOff } from 'lucide-react'
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
    nextHiddenPermissions?: Array<string>,
  ) => {
    if (!selectedRoleId) return

    setPendingKey(pendingId)
    updatePermissions.mutate(
      {
        roleId: selectedRoleId,
        permissions: nextPermissions,
        restrictions,
        hiddenPermissions: nextHiddenPermissions ?? rolePermissions?.hiddenPermissions,
      },
      {
        onSettled: () => setPendingKey(null),
      },
    )
  }

  const handleToggleHidePermissions = (permissionKeys: string[]) => {
    if (!selectedRoleId || permissionKeys.length === 0) return
    const currentHidden = rolePermissions?.hiddenPermissions ?? []
    
    // Check if all permissionKeys are currently hidden
    const isHidden = permissionKeys.every(p => currentHidden.includes(p))
    
    let nextHidden: string[]
    if (isHidden) {
      // Unhide: remove permissionKeys from hiddenPermissions
      nextHidden = currentHidden.filter(p => !permissionKeys.includes(p))
    } else {
      // Hide: add permissionKeys to hiddenPermissions
      nextHidden = [...new Set([...currentHidden, ...permissionKeys])]
    }
    
    savePermissions(permissions, `hide:${permissionKeys[0]}`, nextHidden)
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
                  
                const majorKeys = majorItems.map(i => i.key)
                const isMajorHidden = majorKeys.length > 0 && majorKeys.every(k => rolePermissions?.hiddenPermissions?.includes(k))

                return (
                  <div
                    key={majorGroup.id}
                    className={cn("rounded-lg border border-border bg-card shadow-sm transition-opacity", isMajorHidden && 'opacity-50')}
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
                          {t('matrix.grantedCount', {
                            granted: majorItems.filter((i) =>
                              isPermissionGranted(permissions, i.key, i.module),
                            ).length,
                            total: majorItems.length,
                          })}
                        </span>
                        {showHideControls && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn('size-7 hover:bg-transparent', isMajorHidden ? 'text-muted-foreground' : 'text-primary')}
                            onClick={(e) => { e.preventDefault(); handleToggleHidePermissions(majorKeys); }}
                            title="Ẩn/Hiện nhóm quyền"
                          >
                            {isMajorHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                          
                        const subKeys = subItems.map(i => i.key)
                        const isSubHidden = subKeys.length > 0 && subKeys.every(k => rolePermissions?.hiddenPermissions?.includes(k))

                        // If sub has nested sub-groups (like Danh mục dùng chung, Cấu hình dữ liệu)
                        if (sub.groups && sub.groups.length > 0) {
                          return (
                            <div key={sub.id} className={cn("flex flex-col gap-4 py-5 first:pt-0 last:pb-0 transition-opacity", isSubHidden && 'opacity-50')}>
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
                                    className={cn('size-6 hover:bg-transparent', isSubHidden ? 'text-muted-foreground' : 'text-primary')}
                                    onClick={(e) => { e.preventDefault(); handleToggleHidePermissions(subKeys); }}
                                    title="Ẩn/Hiện nhóm quyền"
                                  >
                                    {isSubHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
                                    
                                  const groupKeys = groupItems.map(i => i.key)
                                  const isGroupHidden = groupKeys.length > 0 && groupKeys.every(k => rolePermissions?.hiddenPermissions?.includes(k))

                                  return (
                                    <div key={group.id} className={cn("flex flex-col gap-3 transition-opacity", isGroupHidden && 'opacity-50')}>
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
                                            className={cn('size-6 hover:bg-transparent', isGroupHidden ? 'text-muted-foreground' : 'text-primary')}
                                            onClick={(e) => { e.preventDefault(); handleToggleHidePermissions(groupKeys); }}
                                            title="Ẩn/Hiện nhóm quyền"
                                          >
                                            {isGroupHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
                                          onToggleItems={handleToggleItems}
                                          showHideControls={showHideControls}
                                          hiddenPermissions={rolePermissions?.hiddenPermissions ?? []}
                                          onToggleHide={handleToggleHidePermissions}
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
                          <div key={sub.id} className={cn("flex flex-col gap-3 py-5 first:pt-0 last:pb-0 transition-opacity", isSubHidden && 'opacity-50')}>
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
                                    className={cn('size-6 hover:bg-transparent', isSubHidden ? 'text-muted-foreground' : 'text-primary')}
                                    onClick={(e) => { e.preventDefault(); handleToggleHidePermissions(subKeys); }}
                                    title="Ẩn/Hiện nhóm quyền"
                                  >
                                    {isSubHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
                                          onToggleItems={handleToggleItems}
                                          showHideControls={showHideControls}
                                          hiddenPermissions={rolePermissions?.hiddenPermissions ?? []}
                                          onToggleHide={handleToggleHidePermissions}
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

function SinglePermissionItem({
  item,
  permissions,
  pendingKey,
  canManageRoles,
  onToggle,
  showHideControls = false,
  hiddenPermissions = [],
  onToggleHide,
}: {
  item: PermissionCatalogItemT
  permissions: string[]
  pendingKey: string | null
  canManageRoles: boolean
  onToggle: (item: PermissionCatalogItemT, currentlyGranted: boolean) => void
  showHideControls?: boolean
  hiddenPermissions?: string[]
  onToggleHide?: (keys: string[]) => void
}) {
  const { t } = useTranslation('permissions')
  const granted = isPermissionGranted(permissions, item.key, item.module)
  const isPending = pendingKey === `permission:${item.key}`
  const disabled = !canManageRoles || isPending
  const isHidden = hiddenPermissions.includes(item.key)

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md hover:bg-muted/40 transition-colors',
        isHidden && 'opacity-50',
      )}
    >
      <label
        className={cn(
          'flex flex-1 items-start gap-3 p-2',
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
      {showHideControls && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'size-7 mt-1.5 shrink-0 hover:bg-transparent',
            isHidden ? 'text-muted-foreground' : 'text-primary',
          )}
          onClick={(e) => {
            e.preventDefault()
            onToggleHide?.([item.key])
          }}
          title={t('matrix.toggleHideParentAndChildren')}
        >
          {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      )}
    </div>
  )
}

function CollapsiblePermissionGroup({
  parentItem,
  childItems,
  permissions,
  pendingKey,
  canManageRoles,
  onToggle,
  onToggleItems,
  showHideControls = false,
  hiddenPermissions = [],
  onToggleHide,
}: {
  parentItem: PermissionCatalogItemT
  childItems: PermissionCatalogItemT[]
  permissions: string[]
  pendingKey: string | null
  canManageRoles: boolean
  onToggle: (item: PermissionCatalogItemT, currentlyGranted: boolean) => void
  onToggleItems?: (
    items: PermissionCatalogItemT[],
    currentlyGranted: boolean,
    pendingId: string,
  ) => void
  showHideControls?: boolean
  hiddenPermissions?: string[]
  onToggleHide?: (keys: string[]) => void
}) {
  const { t } = useTranslation('permissions')
  const [isExpanded, setIsExpanded] = useState(false)

  const parentGranted = isPermissionGranted(
    permissions,
    parentItem.key,
    parentItem.module,
  )
  const grantedChildCount = childItems.filter((child) =>
    isPermissionGranted(permissions, child.key, child.module),
  ).length
  const allChildrenGranted =
    childItems.length > 0 && grantedChildCount === childItems.length
  const isPending =
    pendingKey === `permission:${parentItem.key}` ||
    pendingKey === `group-all:${parentItem.key}`
  const disabled = !canManageRoles || isPending
  const isHidden = hiddenPermissions.includes(parentItem.key)

  const allGroupItems = [parentItem, ...childItems]
  const isAllGranted = parentGranted && allChildrenGranted

  const handleToggleAllSub = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onToggleItems || disabled) return
    onToggleItems(allGroupItems, isAllGranted, `group-all:${parentItem.key}`)
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/20 p-3 transition-colors',
        isHidden && 'opacity-50',
      )}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Mũi tên thu / mở */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? t('matrix.collapseSubPermissions') : t('matrix.expandSubPermissions')}
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform duration-200',
                isExpanded && 'rotate-90',
              )}
            />
          </Button>

          {/* Quyền tổng / Parent Checkbox */}
          <label
            className={cn(
              'flex flex-1 items-start gap-2.5 rounded px-1.5 py-1',
              disabled ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            <Checkbox
              checked={parentGranted}
              disabled={disabled}
              onCheckedChange={() => onToggle(parentItem, parentGranted)}
              className="mt-0.5 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold leading-tight text-foreground block">
                {parentItem.label}
              </span>
              {parentItem.description ? (
                <span className="mt-0.5 block text-xs leading-normal text-muted-foreground">
                  {parentItem.description}
                </span>
              ) : null}
            </span>
          </label>
        </div>

        {/* Counter & Quick action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
            {t('matrix.subPermissionCount', {
              granted: grantedChildCount,
              total: childItems.length,
            })}
          </span>

          {onToggleItems && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-medium px-2.5"
              disabled={disabled}
              onClick={handleToggleAllSub}
              title={t('matrix.quickSelectAllTitle')}
            >
              {isAllGranted ? t('matrix.deselectAll') : t('matrix.quickSelectAll')}
            </Button>
          )}

          {showHideControls && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-7 hover:bg-transparent',
                isHidden ? 'text-muted-foreground' : 'text-primary',
              )}
              onClick={(e) => {
                e.preventDefault()
                onToggleHide?.([
                  parentItem.key,
                  ...childItems.map((c) => c.key),
                ])
              }}
              title={t('matrix.toggleHideParentAndChildren')}
            >
              {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Child Permissions List */}
      {isExpanded && (
        <div className="mt-3 ml-7 border-l-2 border-primary/30 pl-4 py-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t('matrix.subPermissionsHeader')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
            {childItems.map((child) => (
              <SinglePermissionItem
                key={child.key}
                item={child}
                permissions={permissions}
                pendingKey={pendingKey}
                canManageRoles={canManageRoles}
                onToggle={onToggle}
                showHideControls={showHideControls}
                hiddenPermissions={hiddenPermissions}
                onToggleHide={onToggleHide}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PermissionGrid({
  items,
  permissions,
  pendingKey,
  canManageRoles,
  onToggle,
  onToggleItems,
  showHideControls = false,
  hiddenPermissions = [],
  onToggleHide,
}: {
  items: PermissionCatalogItemT[]
  permissions: string[]
  pendingKey: string | null
  canManageRoles: boolean
  onToggle: (item: PermissionCatalogItemT, currentlyGranted: boolean) => void
  onToggleItems?: (
    items: PermissionCatalogItemT[],
    currentlyGranted: boolean,
    pendingId: string,
  ) => void
  showHideControls?: boolean
  hiddenPermissions?: string[]
  onToggleHide?: (keys: string[]) => void
}) {
  // Tự động gom nhóm các item có quan hệ cha-con (như 'dashboard.admin' và 'dashboard.admin.*')
  const parentChildMap = useMemo(() => {
    const map = new Map<string, PermissionCatalogItemT[]>()
    for (const parentCandidate of items) {
      const children = items.filter(
        (child) =>
          child.key !== parentCandidate.key &&
          child.key.startsWith(`${parentCandidate.key}.`),
      )
      if (children.length > 0) {
        map.set(parentCandidate.key, children)
      }
    }
    return map
  }, [items])

  const childKeySet = useMemo(() => {
    const set = new Set<string>()
    for (const children of parentChildMap.values()) {
      for (const child of children) {
        set.add(child.key)
      }
    }
    return set
  }, [parentChildMap])

  const standaloneItems = useMemo(
    () =>
      items.filter(
        (item) => !parentChildMap.has(item.key) && !childKeySet.has(item.key),
      ),
    [items, parentChildMap, childKeySet],
  )

  const parentItems = useMemo(
    () => items.filter((item) => parentChildMap.has(item.key)),
    [items, parentChildMap],
  )

  // Split standalone items into 2-column rows
  const standaloneRows: Array<Array<PermissionCatalogItemT>> = useMemo(() => {
    const rows: Array<Array<PermissionCatalogItemT>> = []
    for (let index = 0; index < standaloneItems.length; index += 2) {
      rows.push(standaloneItems.slice(index, index + 2))
    }
    return rows
  }, [standaloneItems])

  return (
    <div className="flex flex-col gap-4">
      {/* Các quyền độc lập (Standalone) */}
      {standaloneRows.length > 0 && (
        <div className="flex flex-col gap-3">
          {standaloneRows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3"
            >
              {row.map((item) => (
                <SinglePermissionItem
                  key={item.key}
                  item={item}
                  permissions={permissions}
                  pendingKey={pendingKey}
                  canManageRoles={canManageRoles}
                  onToggle={onToggle}
                  showHideControls={showHideControls}
                  hiddenPermissions={hiddenPermissions}
                  onToggleHide={onToggleHide}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Các nhóm quyền thu mở có sub-permissions (như Dashboard quản trị) */}
      {parentItems.map((parentItem) => {
        const childItems = parentChildMap.get(parentItem.key) ?? []
        return (
          <CollapsiblePermissionGroup
            key={parentItem.key}
            parentItem={parentItem}
            childItems={childItems}
            permissions={permissions}
            pendingKey={pendingKey}
            canManageRoles={canManageRoles}
            onToggle={onToggle}
            onToggleItems={onToggleItems}
            showHideControls={showHideControls}
            hiddenPermissions={hiddenPermissions}
            onToggleHide={onToggleHide}
          />
        )
      })}
    </div>
  )
}

export function PermissionMatrixLegend() {
  return null
}
