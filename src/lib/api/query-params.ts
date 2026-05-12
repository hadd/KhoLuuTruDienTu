/**
 * Standard query parameters for list endpoints (pagination, search, sort).
 * Use with appendListParams when building URL query strings.
 */
export interface ListQueryParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  /** Set to false to disable paging (e.g. for search selects). */
  paging?: boolean
}

/**
 * Appends standard list query params to a URLSearchParams instance.
 * Only sets a param when the value is defined; avoids empty query keys.
 *
 * @param searchParams - URLSearchParams instance to append to
 * @param params - Optional list params (page, limit, search, sort, paging)
 */
export function appendListParams(
  searchParams: URLSearchParams,
  params?: ListQueryParams | null,
): void {
  if (!params) return
  if (params.search != null && params.search !== '')
    searchParams.set('search', params.search)
  if (params.page != null && params.page > 0)
    searchParams.set('page', String(params.page))
  if (params.limit != null && params.limit > 0)
    searchParams.set('limit', String(params.limit))
  if (params.sort != null && params.sort !== '')
    searchParams.set('sort', params.sort)
  if (params.paging === false) searchParams.set('paging', 'false')
}
