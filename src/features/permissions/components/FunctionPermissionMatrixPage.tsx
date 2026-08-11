import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RoleCreateDialog } from '@/features/permissions/components/RoleCreateDialog'
import { RoleDeleteDialog } from '@/features/permissions/components/RoleDeleteDialog'
import { RolePermissionEditor } from '@/features/permissions/components/RolePermissionEditor'
import {
  permissionRolesQueryOptions,
  permissionsCatalogQueryOptions,
  rolePermissionsQueryOptions,
} from '@/features/permissions/queries'
import { useRoleAccess } from '@/features/permissions/hooks/useRoleAccess'
import type { PermissionRoleT } from '@/features/permissions/types'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'

const routeApi = getRouteApi('/app/permissions/function-matrix')

export function FunctionPermissionMatrixPage() {
  const { t } = useTranslation('permissions')
  const navigate = routeApi.useNavigate()
  const { q, roleId } = routeApi.useSearch()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<PermissionRoleT | null>(null)
  const { canManageRoles } = useRoleAccess()

  const rolesQuery = useQuery(permissionRolesQueryOptions())
  const catalogQuery = useQuery(permissionsCatalogQueryOptions())

  const roles = rolesQuery.data ?? []
  const selectedRoleId =
    roleId && roles.some((role) => role.id === roleId) ? roleId : roles[0]?.id
  const isSelectedRoleValid = Boolean(
    selectedRoleId && roles.some((role) => role.id === selectedRoleId),
  )

  useEffect(() => {
    if (roles.length === 0) return

    const resolvedRoleId =
      roleId && roles.some((role) => role.id === roleId) ? roleId : roles[0]?.id

    if (resolvedRoleId && resolvedRoleId !== roleId) {
      void navigate({
        search: (prev) => ({
          ...prev,
          roleId: resolvedRoleId,
        }),
        replace: true,
      })
    }
  }, [roleId, roles, navigate])

  const rolePermissionsQuery = useQuery({
    ...rolePermissionsQueryOptions(selectedRoleId ?? ''),
    enabled: isSelectedRoleValid,
  })

  const isLoading = rolesQuery.isLoading || catalogQuery.isLoading
  const isError = rolesQuery.isError || catalogQuery.isError
  const isRolePermissionsError = rolePermissionsQuery.isError

  const debouncedSearch = useDebouncedCallback((value: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: value.trim() || undefined,
      }),
    })
  }, 300)

  const handleSelectRole = (nextRoleId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        roleId: nextRoleId,
      }),
    })
  }

  const handleRetry = () => {
    void rolesQuery.refetch()
    void catalogQuery.refetch()
    if (selectedRoleId) {
      void rolePermissionsQuery.refetch()
    }
  }

  const handleRoleCreated = (nextRoleId: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        roleId: nextRoleId,
      }),
    })
  }

  const handleRoleDeleting = (deletedRoleId: string) => {
    if (selectedRoleId !== deletedRoleId) return

    const remainingRoles = roles.filter((role) => role.id !== deletedRoleId)
    void navigate({
      search: (prev) => ({
        ...prev,
        roleId: remainingRoles[0]?.id,
      }),
    })
  }

  return (
    <div
      className="-m-6 flex min-h-0 flex-col gap-4 overflow-hidden p-6"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            defaultValue={q ?? ''}
            placeholder={t('search.placeholder')}
            className="pl-9"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        {canManageRoles ? (
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            {t('roles.actions.create')}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <MatrixLoadingSkeleton />
      ) : isError || isRolePermissionsError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">
            {t('errors.loadFailed')}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('actions.retry')}
          </button>
        </div>
      ) : (
        <RolePermissionEditor
          roles={roles}
          catalog={catalogQuery.data ?? []}
          rolePermissions={rolePermissionsQuery.data}
          selectedRoleId={selectedRoleId}
          searchQuery={q}
          onSelectRole={handleSelectRole}
          onDeleteRole={setRoleToDelete}
          canManageRoles={canManageRoles}
        />
      )}

      <RoleCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleRoleCreated}
      />
      <RoleDeleteDialog
        open={Boolean(roleToDelete)}
        onOpenChange={(open) => {
          if (!open) setRoleToDelete(null)
        }}
        role={roleToDelete}
        onBeforeDelete={handleRoleDeleting}
      />
    </div>
  )
}

function MatrixLoadingSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-2 overflow-hidden rounded-md border border-border p-4">
      <div className="h-full w-52 animate-pulse rounded-md bg-muted" />
      <div className="h-full flex-1 animate-pulse rounded-md bg-muted" />
    </div>
  )
}
