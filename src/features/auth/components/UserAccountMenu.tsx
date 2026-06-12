import { useQuery } from '@tanstack/react-query'
import { LogOut, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MOCK_USER_AVATAR_URL,
  resolveAvatarUrl,
} from '@/features/auth/constants'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import { cn } from '@/lib/utils/cn'

interface UserAccountMenuProps {
  collapsed?: boolean
  variant?: 'sidebar' | 'header'
}

function AvatarCircle({
  avatarUrl,
  name,
  email,
  className,
}: {
  avatarUrl: string
  name?: string | null
  email?: string | null
  className?: string
}) {
  const displayName = name || email || '-'
  const [src, setSrc] = useState(avatarUrl)

  useEffect(() => {
    setSrc(avatarUrl)
  }, [avatarUrl])

  return (
    <img
      src={src}
      alt={displayName}
      className={cn('size-8 shrink-0 rounded-full object-cover', className)}
      onError={() => {
        if (src !== MOCK_USER_AVATAR_URL) {
          setSrc(MOCK_USER_AVATAR_URL)
        }
      }}
    />
  )
}

export function UserAccountMenu({
  collapsed = false,
  variant = 'sidebar',
}: UserAccountMenuProps) {
  const { t } = useTranslation('auth')
  const logoutMutation = useLogout()

  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(getAccessToken()),
  })

  const displayName = user?.fullName || user?.email || '-'
  const avatarUrl = resolveAvatarUrl(user?.avatarUrl)
  const isHeader = variant === 'header'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center rounded-md text-foreground transition-colors hover:bg-muted',
            isHeader
              ? 'gap-2 px-2 py-1.5'
              : cn(
                  'w-full',
                  collapsed ? 'justify-center p-2' : 'gap-2 px-2 py-2',
                ),
          )}
          aria-label={t('userMenu.profile')}
        >
          <AvatarCircle
            avatarUrl={avatarUrl}
            name={user?.fullName}
            email={user?.email}
          />
          {(!collapsed || isHeader) && (
            <span
              className={cn(
                'truncate text-sm font-medium uppercase',
                isHeader ? 'max-w-[12rem]' : 'min-w-0 flex-1 text-left',
              )}
            >
              {displayName}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isHeader ? 'bottom' : 'top'}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <AvatarCircle
              avatarUrl={avatarUrl}
              name={user?.fullName}
              email={user?.email}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {displayName}
              </div>
              {user?.email && (
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User />
          {t('userMenu.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logoutMutation.isPending}
          onSelect={() => {
            void logoutMutation.mutateAsync()
          }}
        >
          <LogOut />
          {logoutMutation.isPending ? t('userMenu.loggingOut') : t('userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
