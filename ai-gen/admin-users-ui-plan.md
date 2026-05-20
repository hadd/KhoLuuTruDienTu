# Kế hoạch triển khai: Admin Users — Modal mock, tìm kiếm URL, cột vai trò, layout admin

Tài liệu này gom **mục tiêu**, **cây file**, và **mã mẫu đầy đủ** để một lần implement đạt các yêu cầu đã nêu (chưa gọi API thật — chỉ mock / `console.log` / toast nếu có sẵn).

---

## 1. Mục tiêu (checklist)

| # | Yêu cầu | Cách đáp ứng |
|---|--------|---------------|
| 1 | Click **Sửa** → modal form, nút đóng (X), nút **Lưu** góc phải; **chưa** gọi API | `Dialog` (Shadcn) + `DialogFooter` căn phải; submit handler `console.log` / toast mock |
| 2 | **Thêm mới** dùng chung modal với **Sửa**; nút chính đổi label **Thêm mới** vs **Lưu** | Một component `UserUpsertDialog` với prop `mode: 'create' \| 'edit'` |
| 3 | Click **Xóa** → modal xác nhận mock | `AlertDialog`; confirm → mock |
| 4 | Nút **Import Excel** cạnh **Thêm mới** | `Button` + `FileUpload` ẩn hoặc `onClick` mở `input type="file"` mock |
| 5 | Bảng bị thu hẹp trái → mở rộng | `admin/route.tsx`: `main` dùng `flex-1 min-w-0`; route users: `w-full max-w-full` |
| 6 | Cột **Vai trò** (mock) | Helper `getMockRoleForUser(userId)` + cột `<Badge>` |
| 7 | **AdminLayout** có style | Tailwind + token semantic; `Link` active style (`activeProps`) |
| 8 | **Thanh tìm kiếm** dưới title | `Input` + đồng bộ `?q=` qua `validateSearch` (Zod) |
| 9 | Icon **Khóa / deactivate** cạnh Sửa, Xóa | `Button` + `Lock` hoặc `UserRoundX` (lucide); dialog xác nhận mock |

**Quy ước dự án:** không hardcode chuỗi UI — mở rộng namespace `user` (đã có trong `i18n/config.ts`) và bổ sung key `admin.*` trong `common` cho menu admin.

---

## 2. Cây file ảnh hưởng

```
src/
├── app/routes/admin/
│   ├── route.tsx (modified)
│   └── users/
│       └── index.tsx (modified)
├── features/user/
│   ├── components/
│   │   ├── ManageUser.tsx (modified)
│   │   ├── UserUpsertDialog.tsx (new)
│   │   ├── UserDeleteDialog.tsx (new)
│   │   └── UserDeactivateDialog.tsx (new)
│   └── lib/
│       └── mockUserRole.ts (new)
├── lib/i18n/locales/
│   ├── en/common.json (modified)
│   ├── vi/common.json (modified)
│   ├── en/user.json (modified)
│   └── vi/user.json (modified)
└── types/
    └── i18next.d.ts (modified)
```

---

## 3. i18n — bổ sung key

### 3.1 `src/lib/i18n/locales/en/common.json` (merge vào object gốc)

```json
{
  "admin": {
    "menuTitle": "Administration",
    "users": "User management",
    "groups": "Group management"
  }
}
```

### 3.2 `src/lib/i18n/locales/vi/common.json` (merge)

```json
{
  "admin": {
    "menuTitle": "Quản trị",
    "users": "Quản lý người dùng",
    "groups": "Quản lý nhóm"
  }
}
```

### 3.3 `src/lib/i18n/locales/en/user.json` (merge — giữ key cũ, thêm các block sau)

```json
{
  "search": {
    "placeholder": "Search by name or email..."
  },
  "actions": {
    "importExcel": "Import Excel",
    "createSubmit": "Add new",
    "deactivate": "Deactivate account",
    "deactivateConfirm": "Deactivate",
    "importMockSuccess": "Import (mock): file received."
  },
  "table": {
    "columns": {
      "role": "Role"
    }
  },
  "dialog": {
    "createTitle": "Add user",
    "editTitle": "Edit user",
    "deleteTitle": "Delete user?",
    "deleteDescription": "This action cannot be undone (mock — no API call).",
    "deactivateTitle": "Deactivate account?",
    "deactivateDescription": "The user will not be able to sign in (mock — no API call)."
  },
  "form": {
    "labels": {
      "firstName": "First name",
      "lastName": "Last name"
    },
    "placeholders": {
      "firstName": "First name",
      "lastName": "Last name"
    }
  },
  "mock": {
    "roles": {
      "admin": "Administrator",
      "teacher": "Teacher",
      "student": "Student",
      "viewer": "Viewer"
    }
  }
}
```

### 3.4 `src/lib/i18n/locales/vi/user.json` (merge)

```json
{
  "search": {
    "placeholder": "Tìm theo tên hoặc email..."
  },
  "actions": {
    "importExcel": "Nhập Excel",
    "createSubmit": "Thêm mới",
    "deactivate": "Khóa tài khoản",
    "deactivateConfirm": "Vô hiệu hóa",
    "importMockSuccess": "Nhập (mock): đã nhận file."
  },
  "table": {
    "columns": {
      "role": "Vai trò"
    }
  },
  "dialog": {
    "createTitle": "Thêm người dùng",
    "editTitle": "Sửa người dùng",
    "deleteTitle": "Xóa người dùng?",
    "deleteDescription": "Thao tác không thể hoàn tác (mock — chưa gọi API).",
    "deactivateTitle": "Khóa tài khoản?",
    "deactivateDescription": "Người dùng sẽ không thể đăng nhập (mock — chưa gọi API)."
  },
  "form": {
    "labels": {
      "firstName": "Tên",
      "lastName": "Họ"
    },
    "placeholders": {
      "firstName": "Tên",
      "lastName": "Họ"
    }
  },
  "mock": {
    "roles": {
      "admin": "Quản trị",
      "teacher": "Giáo viên",
      "student": "Học sinh",
      "viewer": "Người xem"
    }
  }
}
```

### 3.5 `src/types/i18next.d.ts` — thêm namespace `user` cho type-safe `t()`

```typescript
import 'i18next'

import type enAuth from '@/lib/i18n/locales/en/auth.json'
import type enCommon from '@/lib/i18n/locales/en/common.json'
import type enHome from '@/lib/i18n/locales/en/home.json'
import type enUser from '@/lib/i18n/locales/en/user.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof enCommon
      auth: typeof enAuth
      home: typeof enHome
      user: typeof enUser
    }
  }
}
```

---

## 4. Mock vai trò theo `user.id`

### `src/features/user/lib/mockUserRole.ts` (new)

```typescript
import type { UserT } from '@/features/user/types'

const ROLE_KEYS = ['admin', 'teacher', 'student', 'viewer'] as const
export type MockUserRoleKey = (typeof ROLE_KEYS)[number]

/** Deterministic mock role from user id (no API). */
export function getMockRoleKeyForUser(user: UserT): MockUserRoleKey {
  const idx = Math.abs(Number(user.id)) % ROLE_KEYS.length
  return ROLE_KEYS[idx] ?? 'viewer'
}
```

---

## 5. Admin layout có style (semantic tokens)

### `src/app/routes/admin/route.tsx` (full replacement)

```tsx
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-0 w-full flex-1 bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('admin.menuTitle')}
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <AdminNavLink to="/admin/users" label={t('admin.users')} icon={Users} />
          <AdminNavLink to="/admin/groups" label={t('admin.groups')} icon={UsersRound} />
        </nav>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function AdminNavLink({
  to,
  label,
  icon: Icon,
}: {
  to: '/admin/users' | '/admin/groups'
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      to={to}
      className="block"
      activeProps={{
        className: '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
      }}
      inactiveProps={{
        className: '[&>div]:hover:bg-muted/80',
      }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
            !isActive && 'text-muted-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </div>
      )}
    </Link>
  )
}
```

---

## 6. Dialog thêm/sửa (mock submit)

### `src/features/user/components/UserUpsertDialog.tsx` (new)

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserT } from '@/features/user/types'

export type UserUpsertMode = 'create' | 'edit'

interface UserUpsertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: UserUpsertMode
  user: UserT | null
}

export function UserUpsertDialog({
  open,
  onOpenChange,
  mode,
  user,
}: UserUpsertDialogProps) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && user) {
      setFirstName(user.firstName)
      setLastName(user.lastName)
      setEmail(user.email)
    } else {
      setFirstName('')
      setLastName('')
      setEmail('')
    }
  }, [open, mode, user])

  const primaryLabel =
    mode === 'create' ? t('actions.createSubmit') : t('actions.save')

  function handleSubmitMock() {
    // Mock only — replace with mutation later
    console.log('[UserUpsertDialog mock]', { mode, firstName, lastName, email, userId: user?.id })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="user-first">{t('form.labels.firstName')}</Label>
            <Input
              id="user-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('form.placeholders.firstName')}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-last">{t('form.labels.lastName')}</Label>
            <Input
              id="user-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('form.placeholders.lastName')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">{t('form.labels.email')}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('form.placeholders.email')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmitMock}>
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Lưu ý:** Nếu `user.json` chưa có `form.labels.email` / `form.placeholders.email`, dùng key đã có trong file hiện tại (`form.labels.name` → có thể tách thành first/last như plan, hoặc map `name` cho một field). File `en/user.json` mẫu phần 3 đã thêm `firstName`/`lastName`; **email** đã có sẵn trong `form.labels` của repo — giữ `t('form.labels.email')` nếu key tồn tại.

Sửa nhẹ nếu JSON của bạn dùng `form.labels.name` thay vì `email`: đổi label email thành `t('table.columns.email')` hoặc thêm key `form.labels.email` cho đồng nhất.

---

## 7. Dialog xóa & deactivate (mock)

### `src/features/user/components/UserDeleteDialog.tsx` (new)

```tsx
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { UserT } from '@/features/user/types'

interface UserDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserT | null
}

export function UserDeleteDialog({ open, onOpenChange, user }: UserDeleteDialogProps) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')

  function handleConfirmMock() {
    console.log('[UserDeleteDialog mock]', user?.id)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialog.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('dialog.deleteDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmMock}>{t('actions.delete')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### `src/features/user/components/UserDeactivateDialog.tsx` (new)

```tsx
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { UserT } from '@/features/user/types'

interface UserDeactivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserT | null
}

export function UserDeactivateDialog({
  open,
  onOpenChange,
  user,
}: UserDeactivateDialogProps) {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')

  function handleConfirmMock() {
    console.log('[UserDeactivateDialog mock]', user?.id)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialog.deactivateTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dialog.deactivateDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmMock}>
            {t('actions.deactivateConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 8. Bảng người dùng — cột vai trò, nút khóa, full width

### `src/features/user/components/ManageUser.tsx` (full replacement mẫu)

```tsx
import { Edit, FileLock2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'
import type { UserT } from '@/features/user/types'
import { getMockRoleKeyForUser } from '@/features/user/lib/mockUserRole'

interface UserTableProps {
  users?: Array<UserT> | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  onEdit: (user: UserT) => void
  onDelete: (user: UserT) => void
  onDeactivate: (user: UserT) => void
}

export function UserTable({
  users,
  isLoading,
  isError,
  error,
  onEdit,
  onDelete,
  onDeactivate,
}: UserTableProps) {
  const { t } = useTranslation('user')

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('status.loading')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {error?.message || t('status.error')}
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('table.columns.name')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.email')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.role')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('table.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {t('table.emptyMessage')}
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const roleKey = getMockRoleKeyForUser(user)
                return (
                  <tr key={user.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-normal">
                        {t(`mock.roles.${roleKey}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(user)}
                          title={t('actions.edit')}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onDeactivate(user)}
                          title={t('actions.deactivate')}
                        >
                          <FileLock2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDelete(user)}
                          title={t('actions.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
```

**Ghi chú:** Đảm bảo `user.json` có `actions.cancel` không bắt buộc ở file này. `table.columns.name` — file hiện tại repo dùng `name` / `email` / `actions`; đã thêm `role`.

---

## 9. Route `/admin/users` — search URL, import mock, state dialog

### `src/app/routes/admin/users/index.tsx` (full replacement mẫu)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAllUsers } from '@/features/user/api/userClient'
import { UserTable } from '@/features/user/components/ManageUser'
import { UserDeactivateDialog } from '@/features/user/components/UserDeactivateDialog'
import { UserDeleteDialog } from '@/features/user/components/UserDeleteDialog'
import { UserUpsertDialog } from '@/features/user/components/UserUpsertDialog'
import type { UserUpsertMode } from '@/features/user/components/UserUpsertDialog'
import type { UserT } from '@/features/user/types'
import i18n from '@/lib/i18n/config'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'

const adminUsersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/admin/users/')({
  validateSearch: (raw) => adminUsersSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.user', { ns: 'common' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ManageUserRoute,
})

function ManageUserRoute() {
  const { t } = useTranslation('user')
  const { t: tCommon } = useTranslation('common')
  const search = Route.useSearch()
  const navigate = Route.useNavigate({ from: Route.fullPath })
  const q = search.q ?? ''

  const { data: users, isLoading, isError, error } = useQuery<Array<UserT>>({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })

  const filteredUsers = useMemo(() => {
    if (!users?.length) return users
    const needle = q.trim().toLowerCase()
    if (!needle) return users
    return users.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase()
      return name.includes(needle) || u.email.toLowerCase().includes(needle)
    })
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
```

**Sửa logic search:** Tránh gọi `navigate` hai lần (một debounced một không). Pattern gọn:

- Chỉ dùng **controlled** `value={q}` từ URL + `onChange` cập nhật URL qua `debounced` **hoặc**
- Local state + `useDebounce` + `useEffect` ghi `search.q`

Mẫu ổn định (một nguồn sự thật — URL):

```tsx
const [localQ, setLocalQ] = useState(q)
useEffect(() => setLocalQ(q), [q])

const debouncedCommit = useDebouncedCallback((value: string) => {
  void navigate({
    search: (prev) => ({ ...prev, q: value.trim() || undefined }),
    replace: true,
  })
}, 300)

<Input
  value={localQ}
  onChange={(e) => {
    const v = e.target.value
    setLocalQ(v)
    debouncedCommit(v)
  }}
/>
```

Thay block `handleSearchInput` / `defaultValue` + `key` trong mẫu trên bằng đoạn này.

---

## 10. Thứ tự thực hiện (implementation order)

1. Cập nhật **i18n** (`common`, `user`, `i18next.d.ts`).
2. Thêm **`mockUserRole.ts`**.
3. Thêm **3 dialog components**.
4. Sửa **`ManageUser.tsx`** (props callbacks + cột role).
5. Sửa **`admin/users/index.tsx`** (search, dialogs, import, layout width).
6. Sửa **`admin/route.tsx`** (sidebar style + `min-w-0`).

---

## 11. Tự kiểm tra (theo rule dự án)

- **i18n:** Không hardcode copy UI; key đủ `en` + `vi`.
- **Token:** Layout dùng `bg-background`, `bg-card`, `border-border`, v.v.; badge role có thể `secondary` — không tự phát minh `bg-primary-100`.
- **URL:** `q` trong `validateSearch` (Zod).
- **API:** Không thêm gọi API trong các handler mock.
- **Nút primary:** Tránh `bg-indigo-600` trên route — dùng `Button` mặc định (`bg-primary`).

---

## 12. Tuỳ chọn sau này (ngoài phạm vi mock)

- Thay `console.log` bằng `toast` từ sonner / hook dự án.
- `UserUpsertDialog` nối TanStack Form + Zod + mutation `useMutation`.
- Cột vai trò lấy từ `user.userRoles` khi API sẵn sàng; xóa `getMockRoleKeyForUser`.

---

*Tài liệu sinh cho workspace: `sohoa-web` — đường dẫn `ai-gen/admin-users-ui-plan.md`.*
