/**
 * Serialize filter object to URL query params using bracket notation
 * Example: { type: { $eq: 'subject' } } → filter[type][$eq]=subject
 *
 * @param searchParams - URLSearchParams instance to append to
 * @param filter - Filter object to serialize
 * @param prefix - Prefix for the filter parameter (default: 'filter')
 */
export function serializeFilter(
  searchParams: URLSearchParams,
  filter: Record<string, unknown>,
  prefix = 'filter',
): void {
  for (const [key, value] of Object.entries(filter)) {
    if (value === null || value === undefined) continue

    const paramKey = `${prefix}[${key}]`

    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      // Nested object (e.g., { $eq: 'subject' }) - recurse
      serializeFilter(searchParams, value as Record<string, unknown>, paramKey)
    } else {
      // Primitive value
      searchParams.append(paramKey, String(value))
    }
  }
}
