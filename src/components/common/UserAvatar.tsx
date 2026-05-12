import { cn } from '@/lib/utils/cn'

interface UserAvatarProps {
  avatarUrl?: string | null
  name?: string | null
  email?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showEmail?: boolean
  fallbackInitials?: string
}

/**
 * Generates initials from name or email
 * Takes last 2 words from name, or first letter from email
 */
function generateInitials(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string = 'U',
): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) {
      // Take last 2 words
      return parts
        .slice(-2)
        .map((part) => part[0].toUpperCase())
        .join('')
    }
    if (parts.length === 1) {
      // Single word - take first letter
      return parts[0][0].toUpperCase()
    }
  }

  if (email) {
    return email[0].toUpperCase()
  }

  return fallback
}

const sizeClasses = {
  sm: {
    avatar: 'h-8 w-8',
    text: 'text-xs',
    name: 'text-sm',
    email: 'text-xs',
  },
  md: {
    avatar: 'h-9 w-9',
    text: 'text-xs',
    name: 'text-sm',
    email: 'text-xs',
  },
  lg: {
    avatar: 'h-10 w-10',
    text: 'text-sm',
    name: 'text-sm',
    email: 'text-xs',
  },
  xl: {
    avatar: 'h-12 w-12',
    text: 'text-sm',
    name: 'text-lg',
    email: 'text-sm',
  },
}

/**
 * UserAvatar - Reusable component for displaying user avatar, name, and email
 *
 * Displays avatar image if available, otherwise shows initials in a circle.
 * Supports multiple size variants and optional email display.
 *
 * @example
 * // Basic usage
 * <UserAvatar name="Nguyễn Văn A" email="a@example.com" />
 *
 * @example
 * // With avatar URL
 * <UserAvatar avatarUrl="/avatar.jpg" name="Nguyễn Văn A" email="a@example.com" />
 *
 * @example
 * // Size variants
 * <UserAvatar name="Nguyễn Văn A" size="sm" />
 * <UserAvatar name="Nguyễn Văn A" size="lg" showEmail />
 *
 * @example
 * // Custom fallback
 * <UserAvatar name="Teacher" fallbackInitials="GV" />
 */
export function UserAvatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  className,
  showEmail = true,
  fallbackInitials = 'U',
}: UserAvatarProps) {
  const initials = generateInitials(name, email, fallbackInitials)
  const displayName = name || email || '-'
  const sizes = sizeClasses[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={cn('rounded-full object-cover shrink-0', sizes.avatar)}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground shrink-0',
            sizes.avatar,
            sizes.text,
          )}
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn('font-medium text-foreground truncate', sizes.name)}>
          {displayName}
        </div>
        {showEmail && email && (
          <div className={cn('text-muted-foreground truncate', sizes.email)}>
            {email}
          </div>
        )}
      </div>
    </div>
  )
}
