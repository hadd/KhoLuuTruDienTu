export interface PaginatedResponse<T> {
  items: Array<T>
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
}

/**
 * Raw API response structure for single resource operations (GET by ID, POST, PUT).
 * The API wraps the resource in a `record` property.
 *
 * @example
 * // API returns: { record: { id: "1", name: "Class 5C" } }
 * const response = await apiClient.get<SingleResourceResponse<ClassroomT>>('/classes/1')
 * // response.data = { record: ClassroomT }
 */
export interface SingleResourceResponse<T> {
  record: T
}

/**
 * What client functions return after unwrapping SingleResourceResponse.
 * Client functions unwrap the response: `return response.data.record`
 * So consumers receive the entity directly, not wrapped.
 *
 * @example
 * // Client function:
 * export const getClass = async (): Promise<ClassroomT> => {
 *   const response = await apiClient.get<SingleResourceResponse<ClassroomT>>(...)
 *   return response.data.record  // Returns ClassroomT directly
 * }
 */
export type SingleResponse<T> = T
