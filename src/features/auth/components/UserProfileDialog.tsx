import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { updateProfile } from '@/features/auth/api/authClient'
import {
  MOCK_USER_AVATAR_URL,
  resolveAvatarUrl,
} from '@/features/auth/constants'
import {
  formValuesToUpdateProfilePayload,
  userToProfileFormValues,
} from '@/features/auth/lib/profileFormUtils'
import { profileQueryKey } from '@/features/auth/queries'
import type { UserProfileFormValues } from '@/features/auth/schemas'
import { UserProfileSchema } from '@/features/auth/schemas'
import type { UserT } from '@/features/auth/types'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import { FormField, useAppForm } from '@/lib/forms'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

interface UserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserT | undefined
  isLoading?: boolean
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 border-b border-border py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

function formatOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

function formatGenderLabel(
  gender: string | null | undefined,
  tUser: (key: string) => string,
): string {
  if (gender === 'male') return tUser('form.gender.male')
  if (gender === 'female') return tUser('form.gender.female')
  return '—'
}

function formatOptionalDate(
  value: string | null | undefined,
  locale: 'en' | 'vi',
): string {
  if (!value) return '—'
  return formatDate(value, 'PP', locale)
}

function ProfileAvatar({
  avatarUrl,
  name,
  className,
}: {
  avatarUrl: string
  name: string
  className?: string
}) {
  return (
    <img
      src={avatarUrl}
      alt={name}
      className={cn('size-20 rounded-full object-cover', className)}
      onError={(event) => {
        const target = event.currentTarget
        if (target.src !== MOCK_USER_AVATAR_URL) {
          target.src = MOCK_USER_AVATAR_URL
        }
      }}
    />
  )
}

function ProfileHeader({
  user,
  displayName,
  avatarUrl,
}: {
  user: UserT
  displayName: string
  avatarUrl: string
}) {
  const { t: tUser } = useTranslation('user')
  const roles = user.userRoles ?? []

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <ProfileAvatar avatarUrl={avatarUrl} name={displayName} />
      {user.email ? (
        <p className="text-sm text-muted-foreground">{user.email}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {tUser('form.fields.role.label')}:
        </span>
        {roles.length > 0 ? (
          roles.map((userRole) => (
            <Badge key={userRole.id} variant="secondary">
              {getRoleLabel(userRole.roleId, userRole.role.name) ??
                userRole.roleId}
            </Badge>
          ))
        ) : (
          <span className="text-foreground">{tUser('table.roleUnknown')}</span>
        )}
      </div>
    </div>
  )
}

function UserProfileEditForm({
  user,
  onCancel,
  onSaved,
}: {
  user: UserT
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation('auth')
  const { t: tUser } = useTranslation('user')
  const queryClient = useQueryClient()

  const defaultValues = useMemo(() => userToProfileFormValues(user), [user])

  const mutation = useMutation({
    mutationFn: async (values: UserProfileFormValues) => {
      return updateProfile(formValuesToUpdateProfilePayload(values))
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(profileQueryKey, updatedUser)
      void queryClient.invalidateQueries({ queryKey: profileQueryKey })
      toast.success(t('userProfile.success'))
      onSaved()
    },
    onError: (error: Error) => {
      toast.error(translateError(error) || t('userProfile.errors.saveFailed'))
    },
  })

  const form = useAppForm({
    schema: UserProfileSchema,
    defaultValues,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value)
    },
  })

  const genderOptions = useMemo(
    () => [
      { value: 'male', label: tUser('form.gender.male') },
      { value: 'female', label: tUser('form.gender.female') },
    ],
    [tUser],
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="grid gap-4"
    >
      <FormField
        form={form}
        name="fullName"
        label={tUser('form.fields.fullName.label')}
        placeholder={tUser('form.fields.fullName.placeholder')}
        autoFocus
      />
      <FormField
        form={form}
        name="dateOfBirth"
        label={tUser('form.fields.dateOfBirth.label')}
        placeholder={tUser('form.fields.dateOfBirth.placeholder')}
        as="date"
        validateOn="change"
      />
      <FormField
        form={form}
        name="gender"
        label={tUser('form.fields.gender.label')}
        placeholder={tUser('form.fields.gender.placeholder')}
        as="select"
        options={genderOptions}
      />
      <FormField
        form={form}
        name="phone"
        label={tUser('form.fields.phone.label')}
        placeholder={tUser('form.fields.phone.placeholder')}
        validateOn="change"
        render={(field) => (
          <Input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder={tUser('form.fields.phone.placeholder')}
            value={field.state.value as string}
            disabled={mutation.isPending}
            onBlur={field.handleBlur}
            onChange={(event) => {
              const digitsOnly = event.target.value
                .replace(/\D/g, '')
                .slice(0, 10)
              field.handleChange(digitsOnly)
            }}
            className="w-full"
          />
        )}
      />
      <FormField
        form={form}
        name="address"
        label={tUser('form.fields.address.label')}
        placeholder={tUser('form.fields.address.placeholder')}
        as="textarea"
      />

      <DialogFooter className="px-0">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          {t('userProfile.actions.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? t('userProfile.actions.saving')
            : t('userProfile.actions.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function UserProfileContent({
  user,
  open,
  onClose,
}: {
  user: UserT
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('auth')
  const { t: tUser } = useTranslation('user')
  const lang = useCurrentLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [editSessionKey, setEditSessionKey] = useState(0)

  useEffect(() => {
    if (!open) {
      setIsEditing(false)
      setEditSessionKey(0)
    }
  }, [open])

  const displayName = user.fullName || user.email || '—'
  const avatarUrl = resolveAvatarUrl(user.avatarUrl)

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditSessionKey((current) => current + 1)
  }

  return (
    <>
      <ProfileHeader
        user={user}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />

      <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-2 pr-1">
        {isEditing ? (
          <UserProfileEditForm
            key={`${user.id}-${editSessionKey}`}
            user={user}
            onCancel={handleCancelEdit}
            onSaved={() => setIsEditing(false)}
          />
        ) : (
          <>
            <dl>
              <DetailRow
                label={tUser('form.fields.fullName.label')}
                value={formatOptionalText(user.fullName)}
              />
              <DetailRow
                label={tUser('form.fields.dateOfBirth.label')}
                value={formatOptionalDate(user.dateOfBirth, lang)}
              />
              <DetailRow
                label={tUser('form.fields.gender.label')}
                value={formatGenderLabel(user.gender, tUser)}
              />
              <DetailRow
                label={tUser('form.fields.phone.label')}
                value={formatOptionalText(user.phone)}
              />
              <DetailRow
                label={tUser('form.fields.address.label')}
                value={formatOptionalText(user.address)}
              />
            </dl>

            <DialogFooter className="mt-4 px-0">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('userProfile.actions.close')}
              </Button>
              <Button type="button" onClick={() => setIsEditing(true)}>
                {t('userProfile.actions.edit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </div>
    </>
  )
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  isLoading = false,
}: UserProfileDialogProps) {
  const { t } = useTranslation('auth')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('userProfile.title')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <UserProfileContent
            key={user.id}
            user={user}
            open={open}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('userProfile.errors.loadFailed')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
