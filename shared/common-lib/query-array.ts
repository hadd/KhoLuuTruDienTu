/** Normalize query values into a trimmed string array (supports arrays and comma-separated strings). */
export function normalizeQueryStringArray(
  value?: string | string[] | null,
): string[] | undefined {
  if (value == null) return undefined
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap((item) => item.split(",").map((id) => id.trim()).filter(Boolean))
  return parts.length > 0 ? parts : undefined
}
