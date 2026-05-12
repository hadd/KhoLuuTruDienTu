const SCHOOL_ID_REQUIRED_MESSAGE = 'School ID is required'

/** Options compatible with useQuery when schoolId is present. */
type SchoolIdQueryOptionsShape<TData> = {
  queryKey: ReadonlyArray<unknown>
  queryFn: (...args: Array<unknown>) => Promise<TData>
  enabled?: boolean
}

/**
 * Returns query options that run only when schoolId is present.
 * When schoolId is falsy, returns disabled options with a throw queryFn so useQuery does not run the real query.
 *
 * @param schoolId - Current school ID (may be undefined/null before auth/context is ready)
 * @param getOptions - Function that returns the real query options when schoolId is available
 * @param fallbackQueryKey - Query key for the disabled fallback (e.g. ['lessons', 'missing-school', lessonId, 'items'])
 */
export function withSchoolIdQuery<TData>(
  schoolId: string | undefined | null,
  getOptions: (schoolId: string) => SchoolIdQueryOptionsShape<TData>,
  fallbackQueryKey: ReadonlyArray<unknown>,
): SchoolIdQueryOptionsShape<TData> {
  if (schoolId) {
    return getOptions(schoolId)
  }
  return {
    queryKey: fallbackQueryKey,
    queryFn: () => {
      throw new Error(SCHOOL_ID_REQUIRED_MESSAGE)
    },
    enabled: false,
  }
}
