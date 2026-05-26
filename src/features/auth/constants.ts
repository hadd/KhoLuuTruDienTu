/** Temporary mock avatar until API returns user.avatarUrl */
export const MOCK_USER_AVATAR_URL = '/mock-user-avatar.svg'

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim()
  return trimmed ? trimmed : MOCK_USER_AVATAR_URL
}
