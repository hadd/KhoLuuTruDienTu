
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { requirePermission } from '@/features/auth/routeGuards'
import type { UserT } from '@/features/auth/types'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { UserTable } from '@/features/user/components/ManageUser'
import { UserBulkDeleteDialog } from '@/features/user/components/UserBulkDeleteDialog'
import { UserDeactivateDialog } from '@/features/user/components/UserDeactivateDialog'
import { UserDeleteDialog } from '@/features/user/components/UserDeleteDialog'
import { UserUpsertDialog } from '@/features/user/components/UserUpsertDialog'
import type { UserUpsertMode } from '@/features/user/components/UserUpsertDialog'
import {
  ADMIN_USERS_PAGE_SIZE_OPTIONS,
  DEFAULT_ADMIN_USERS_LIMIT,
  adminRolesQueryOptions,
  adminUsersQueryKeyPrefix,
  adminUsersQueryOptions,
} from '@/features/user/queries'
import { importUsersExcel, exportUsersExcel, downloadUserTemplate } from '@/features/user/api/userClient'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import i18n from '@/lib/i18n/config'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { env } from '@/lib/utils/env'
import { translateError } from '@/lib/utils/translate-error'

const adminUsersLimitSchema = z.coerce
  .number()
  .int()
  .refine((value) =>
    (ADMIN_USERS_PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(value),
  )

const adminUsersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
  limit: adminUsersLimitSchema.optional().catch(DEFAULT_ADMIN_USERS_LIMIT),
})

export const Route = createFileRoute('/app/users/')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.users.module,
    })
  },
  validateSearch: (raw) => adminUsersSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.user', { ns: 'user' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        adminUsersQueryOptions({ page: 1, limit: DEFAULT_ADMIN_USERS_LIMIT }),
      ),
      context.queryClient.ensureQueryData(adminRolesQueryOptions()),
    ])
    return {}
  },
  component: ManageUserRoute,
  errorComponent: AdminUsersErrorComponent,
})

function AdminUsersErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">{t('status.error')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}

function ManageUserRoute() {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = search.q ?? ''
  const roleFilter = search.role
  const currentPage = search.page ?? 1
  const currentLimit = search.limit ?? DEFAULT_ADMIN_USERS_LIMIT

  const { data, isLoading, isError, error } = useQuery(
    adminUsersQueryOptions({ page: currentPage, limit: currentLimit }),
  )
  const { data: roles = [] } = useQuery(adminRolesQueryOptions())
  const users = data?.items ?? []

  const filteredUsers = useMemo(() => {
    if (!users.length) return users
    const needle = q.trim().toLowerCase()
    if (!needle) return users
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle),
    )
  }, [users, q])

  const roleFilteredUsers = useMemo(() => {
    if (!roleFilter) return filteredUsers
    return filteredUsers.filter((user) =>
      user.userRoles?.some((role) => role.roleId === roleFilter),
    )
  }, [filteredUsers, roleFilter])

  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const pagedUsers = roleFilteredUsers

  const [upsertOpen, setUpsertOpen] = useState(false)
  const [upsertMode, setUpsertMode] = useState<UserUpsertMode>('create')
  const [selectedUser, setSelectedUser] = useState<UserT | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set())
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()
  const searchMode = env.USER_SEARCH_MODE
  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const debouncedNavigate = useDebouncedCallback((next: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: next.trim() ? next.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }, 300)

  function handleSearchChange(raw: string) {
    setInputValue(raw)
    if (searchMode === 'debounce') {
      debouncedNavigate(raw)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (searchMode === 'enter' && e.key === 'Enter') {
      void navigate({
        search: (prev) => ({
          ...prev,
          q: inputValue.trim() ? inputValue.trim() : undefined,
          page: 1,
        }),
        replace: true,
      })
    }
  }

  useEffect(() => {
    if (safePage !== currentPage) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, currentPage, navigate])

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: getRoleLabel(role.id, role.name) ?? role.name,
      })),
    [roles],
  )

  return (
    <div className="flex min-h-0 flex-1 w-full max-w-full flex-col gap-6">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              className="max-w-md border-input bg-background"
              placeholder={t('search.placeholder')}
              value={inputValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label={t('search.placeholder')}
            />
            <Select
              value={roleFilter ?? 'all'}
              onValueChange={(value) => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    role: value === 'all' ? undefined : value,
                    page: 1,
                  }),
                  replace: true,
                })
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder={t('filters.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.roleAll')}</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await downloadUserTemplate()
                toast.success(t('actions.downloadTemplateSuccess', 'Tải template thành công'))
              } catch (error) {
                toast.error(t('actions.downloadTemplateError', 'Tải template thất bại'))
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('actions.downloadTemplate')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await exportUsersExcel()
                toast.success(t('actions.exportExcelSuccess', 'Xuất Excel thành công'))
              } catch (error) {
                toast.error(t('actions.exportExcelError', 'Xuất Excel thất bại'))
              }
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('actions.exportExcel')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return

              const ext = f.name.split('.').pop()?.toLowerCase()
              if (!ext || !['xlsx', 'xls'].includes(ext)) {
                toast.error(t('actions.importInvalidFileType'))
                e.target.value = ''
                return
              }

              try {
                const result = await importUsersExcel(f)

                if (result.errorFileDownloaded) {
                  toast.error(t('actions.importValidationError'))
                  return
                }

                if (result.successCount > 0 && result.failedCount === 0 && result.errors.length === 0) {
                  toast.success(
                    t('actions.importSuccessCount', { count: result.successCount }),
                  )
                  void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeyPrefix })
                  return
                }

                if (result.successCount > 0 && (result.failedCount > 0 || result.errors.length > 0)) {
                  toast.warning(
                    t('actions.importPartialSuccess', {
                      successCount: result.successCount,
                      failedCount: result.failedCount || result.errors.length,
                    }),
                  )
                  void queryClient.invalidateQueries({ queryKey: adminUsersQueryKeyPrefix })
                  return
                }

                const detail = result.errors[0]
                toast.error(detail ?? t('actions.importNoRows'))
              } catch (error) {
                toast.error(translateError(error) || t('actions.importError'))
              } finally {
                e.target.value = ''
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('actions.importExcel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setSelectedUser(null)
              setUpsertMode('create')
              setUpsertOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.add')}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <UserTable
          users={pagedUsers}
          isLoading={isLoading}
          isError={isError}
          error={error}
          selectedIds={selectedUserIds}
          onSelectedIdsChange={setSelectedUserIds}
          onEdit={(user) => {
            setSelectedUser(user)
            setUpsertMode('edit')
            setUpsertOpen(true)
          }}
          onDelete={(user) => {
            setSelectedUser(user)
            setDeleteOpen(true)
          }}
          onDeactivate={(user) => {
            setSelectedUser(user)
            setDeactivateOpen(true)
          }}
          onBulkDelete={() => setBulkDeleteOpen(true)}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {tCommon('table.pagination.rowsPerPage')}
            </span>
            <Select
              value={String(currentLimit)}
              onValueChange={(value) => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    limit: Number(value),
                    page: 1,
                  }),
                  replace: true,
                })
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {ADMIN_USERS_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('pagination.status')} {safePage} / {totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  page: Math.max(1, safePage - 1),
                }),
                replace: true,
              })
            }
          >
            {t('pagination.previous')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  page: Math.min(totalPages, safePage + 1),
                }),
                replace: true,
              })
            }
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>

      <UserUpsertDialog
        open={upsertOpen}
        onOpenChange={setUpsertOpen}
        mode={upsertMode}
        user={upsertMode === 'edit' ? selectedUser : null}
      />
      <UserDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} user={selectedUser} />
      <UserBulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        userIds={Array.from(selectedUserIds)}
        onSuccess={(deletedIds) => {
          setSelectedUserIds((prev) => {
            const next = new Set(prev)
            deletedIds.forEach((id) => next.delete(id))
            return next
          })
        }}
      />
      <UserDeactivateDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        user={selectedUser}
      />
    </div>
  )
}
