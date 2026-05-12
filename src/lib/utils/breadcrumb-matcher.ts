/**
 * Checks if a path matches or is a parent of the current pathname.
 * This is useful for determining if a menu item should be highlighted as active,
 * especially for nested routes (e.g., `/course/123/lessons` should match `/course/123`).
 *
 * @param path - The path to check against (e.g., '/course/123')
 * @param currentPathname - The current pathname (e.g., '/course/123/lessons')
 * @param exact - If true, only exact matches are considered. If false (default), prefix matches are allowed.
 * @returns True if the path matches or is a parent of the current pathname
 *
 * @example
 * // Exact match
 * isPathActive('/course/123', '/course/123', true) // true
 * isPathActive('/course/123', '/course/123/lessons', true) // false
 *
 * // Prefix match (default)
 * isPathActive('/course/123', '/course/123', false) // true
 * isPathActive('/course/123', '/course/123/lessons', false) // true
 * isPathActive('/course/123', '/course/456', false) // false
 */
export function isPathActive(
  path: string,
  currentPathname: string,
  exact: boolean = false,
): boolean {
  // Normalize paths by removing trailing slashes (except root)
  const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '')
  const normalizedCurrent =
    currentPathname === '/' ? '/' : currentPathname.replace(/\/$/, '')

  // Exact match mode
  if (exact) {
    return normalizedPath === normalizedCurrent
  }

  // Prefix match mode (default)
  // Check if current pathname starts with the path
  // Handle root path specially
  if (normalizedPath === '/') {
    return normalizedCurrent === '/'
  }

  // Check exact match first
  if (normalizedPath === normalizedCurrent) {
    return true
  }

  // Check if current pathname starts with path + '/'
  // This ensures '/course/123' matches '/course/123/lessons' but not '/course/1234'
  return normalizedCurrent.startsWith(normalizedPath + '/')
}
