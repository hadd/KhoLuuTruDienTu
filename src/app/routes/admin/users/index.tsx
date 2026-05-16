
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { UserT } from '@/features/auth/types'
import { UserTable } from '@/features/user/components/ManageUser'
import { UserDeactivateDialog } from '@/features/user/components/UserDeactivateDialog'
import { UserDeleteDialog } from '@/features/user/components/UserDeleteDialog'
import { UserUpsertDialog } from '@/features/user/components/UserUpsertDialog'
import type { UserUpsertMode } from '@/features/user/components/UserUpsertDialog'
import { adminUsersQueryOptions } from '@/features/user/queries'
import i18n from '@/lib/i18n/config'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { translateError } from '@/lib/utils/translate-error'

const adminUsersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/admin/users/')({
  validateSearch: (raw) => adminUsersSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.user', { ns: 'user' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminUsersQueryOptions())
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
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = search.q ?? ''

  const { data, isLoading, isError, error } = useQuery(adminUsersQueryOptions())
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

  const [upsertOpen, setUpsertOpen] = useState(false)
  const [upsertMode, setUpsertMode] = useState<UserUpsertMode>('create')
  const [selectedUser, setSelectedUser] = useState<UserT | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const setSearchQ = useDebouncedCallback((next: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: next.trim() ? next.trim() : undefined,
      }),
      replace: true,
    })
  }, 300)

  function handleSearchInput(raw: string) {
    setSearchQ(raw)
    void navigate({
      search: (prev) => ({ ...prev, q: raw.trim() ? raw : undefined }),
      replace: true,
    })
  }

  return (
    <div className="flex w-full max-w-full flex-col space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('list.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('list.description')}</p>
          </div>
          <Input
            className="max-w-md border-input bg-background"
            placeholder={t('search.placeholder')}
            defaultValue={q}
            key={q}
            onChange={(e) => handleSearchInput(e.target.value)}
            aria-label={t('search.placeholder')}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              console.log('[import excel mock]', f?.name)
              e.target.value = ''
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

      <UserTable
        users={filteredUsers}
        isLoading={isLoading}
        isError={isError}
        error={error}
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
      />

      <UserUpsertDialog
        open={upsertOpen}
        onOpenChange={setUpsertOpen}
        mode={upsertMode}
        user={upsertMode === 'edit' ? selectedUser : null}
      />
      <UserDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} user={selectedUser} />
      <UserDeactivateDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        user={selectedUser}
      />
    </div>
  )
}
