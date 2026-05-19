---
trigger: model_decision
description: API client conventions and patterns for CRUD operations
globs:
---
# API Client Conventions Guide

Standard patterns cho tất cả CRUD operations trong API client functions. Tuân thủ các conventions này để đảm bảo tính nhất quán và type safety.

## Query Parameters Interface

Tất cả list endpoints sử dụng interface `QueryStringT` cho query parameters:

```typescript
interface QueryStringT {
  page?: number                    // 1-based page number
  limit?: number                   // Items per page (default: 10)
  search?: string                  // Full-text search term
  filter?: Record<string, unknown> // Filter object (bracket notation)
  sort?: string                    // Sort specification (e.g., "name:asc,createdAt:desc")
  paging?: boolean                 // Enable/disable pagination (default: true, use false for search selects)
}
```

**Usage Example:**
```typescript
export const getEntities = async (
  schoolId: string,
  params?: QueryStringT,
): Promise<PaginatedResponse<EntityT>> => {
  // Implementation below
}
```

## List Operations (GET Collection)

**Endpoint Pattern:** `GET /api/v1/{context}/{resource}`

**Response Type:** `PaginatedResponse<T>` (no unwrapping needed)

**Implementation Pattern:**

Use `appendListParams` from `@/lib/api/query-params` for standard list params (page, limit, search, sort, paging). See [Reusable Patterns Guide](reusable-patterns.mdc) for the list query params utility.

```typescript
import { appendListParams } from '@/lib/api/query-params'
import { serializeFilter } from '@/lib/api/filter-utils'

export const getEntities = async (
  schoolId: string,
  params?: {
    page?: number
    limit?: number
    search?: string
    filter?: Record<string, unknown>
    sort?: string
    paging?: boolean
  },
): Promise<PaginatedResponse<EntityT>> => {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, params)

  if (params?.filter) {
    serializeFilter(searchParams, params.filter as Record<string, unknown>)
  }

  const queryString = searchParams.toString()
  const url = `/api/v1/schools/${schoolId}/entities${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<EntityT>>(url)
  return response.data  // ✅ No unwrapping needed for list responses
}
```

## Filter Serialization Pattern

Filters sử dụng bracket notation để express complex query conditions. 

**IMPORTANT:** Use the shared `serializeFilter` utility from `@/lib/api/filter-utils` - **DO NOT duplicate this function**.

**See [Reusable Patterns Guide](reusable-patterns.mdc) for usage details.**

**Quick Reference:**
```typescript
import { serializeFilter } from '@/lib/api/filter-utils'

// In your API client function:
if (params?.filter) {
  serializeFilter(searchParams, params.filter as Record<string, unknown>)
}
```

**Filter Examples:**

```typescript
// Simple equality
{ status: { $eq: 'active' } }
// → filter[status][$eq]=active

// Multiple conditions (AND by default)
{ status: { $eq: 'active' }, grade: { $gte: 10 } }
// → filter[status][$eq]=active&filter[grade][$gte]=10

// IN operator
{ status: { $in: ['active', 'pending'] } }
// → filter[status][$in]=active,pending

// Nested relation
{ 'classroom.grade': { $eq: 10 } }
// → filter[classroom.grade][$eq]=10

// Logical operators ($or, $and)
{ $or: [{ status: { $eq: 'active' } }, { grade: { $gte: 10 } }] }
// → filter[$or][0][status][$eq]=active&filter[$or][1][grade][$gte]=10
```

**Supported Operators:**

| Operator | Description           | Example                                   |
| -------- | --------------------- | ----------------------------------------- |
| `$eq`    | Equal to              | `filter[status][$eq]=active`              |
| `$in`    | In array              | `filter[status][$in]=active,pending`     |
| `$nin`   | Not in array          | `filter[category][$nin]=archived,deleted` |
| `$gt`    | Greater than          | `filter[age][$gt]=18`                     |
| `$gte`   | Greater than or equal | `filter[score][$gte]=80`                  |
| `$lt`    | Less than             | `filter[price][$lt]=100`                  |
| `$lte`   | Less than or equal     | `filter[count][$lte]=5`                   |
| `$like`  | Pattern match (LIKE)  | `filter[name][$like]=%math%`              |

## Detail Operations (GET by ID)

**Endpoint Pattern:** `GET /api/v1/{context}/{resource}/{id}`

**Response Type:** API returns `{ record: T }`, client function unwraps to return `T` directly

**Implementation Pattern:**

```typescript
export const getEntity = async (
  schoolId: string,
  id: string,
): Promise<EntityT> => {
  const response = await apiClient.get<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities/${id}`,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}
```

## Create Operations (POST)

**Endpoint Pattern:** `POST /api/v1/{context}/{resource}`

**Response Type:** API returns `{ record: T }`, client function unwraps to return `T` directly

**Implementation Pattern:**

```typescript
export const createEntity = async (
  schoolId: string,
  data: CreateEntityT,
): Promise<EntityT> => {
  const response = await apiClient.post<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities`,
    data,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}
```

## Update Operations (PUT)

**Endpoint Pattern:** `PUT /api/v1/{context}/{resource}/{id}`

**Response Type:** API returns `{ record: T }`, client function unwraps to return `T` directly

**Implementation Pattern:**

```typescript
export const updateEntity = async (
  schoolId: string,
  id: string,
  data: UpdateEntityT,
): Promise<EntityT> => {
  const response = await apiClient.put<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities/${id}`,
    data,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}
```

## Delete Operations (DELETE)

**Endpoint Pattern:** `DELETE /api/v1/{context}/{resource}/{id}`

**Response Type:** `void` (no response body, or `{ record: { id } }` if backend returns confirmation)

**Implementation Pattern:**

```typescript
export const deleteEntity = async (
  schoolId: string,
  id: string,
): Promise<void> => {
  await apiClient.delete(`/api/v1/schools/${schoolId}/entities/${id}`)
  // ✅ No return value needed for delete operations
}
```

## Response Unwrapping Summary

**List Responses (Paginated):**
- API returns: `PaginatedResponse<T>` directly
- Client function returns: `PaginatedResponse<T>` (no unwrapping)
- Usage: `const response = await apiClient.get<PaginatedResponse<EntityT>>(url); return response.data`

**Single Resource Responses:**
- API returns: `{ record: T }`
- Client function returns: `T` (unwraps `response.data.record`)
- Applies to: GET by ID, POST (create), PUT (update)
- Usage: `const response = await apiClient.get<{ record: EntityT }>(url); return response.data.record`

**Delete Responses:**
- API returns: `void` or `{ record: { id } }`
- Client function returns: `void`
- Usage: `await apiClient.delete(url)`

## Complete CRUD Example

Full example showing all CRUD operations following conventions:

```typescript
// features/entities/api/entityClient.ts

import type { PaginatedResponse } from '@/types/api'
import type { CreateEntityT, EntityT, UpdateEntityT } from '@/types/common'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import { serializeFilter } from '@/lib/api/filter-utils'

// 1. LIST: Get entities with filtering, search, pagination
export const getEntities = async (
  schoolId: string,
  params?: {
    page?: number
    limit?: number
    search?: string
    filter?: Record<string, unknown>
    sort?: string
    paging?: boolean
  },
): Promise<PaginatedResponse<EntityT>> => {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, params)

  if (params?.filter) {
    serializeFilter(searchParams, params.filter as Record<string, unknown>)
  }

  const queryString = searchParams.toString()
  const url = `/api/v1/schools/${schoolId}/entities${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<EntityT>>(url)
  return response.data  // ✅ No unwrapping for list responses
}

// 2. GET: Get single entity by ID
export const getEntity = async (
  schoolId: string,
  id: string,
): Promise<EntityT> => {
  const response = await apiClient.get<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities/${id}`,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}

// 3. CREATE: Create new entity
export const createEntity = async (
  schoolId: string,
  data: CreateEntityT,
): Promise<EntityT> => {
  const response = await apiClient.post<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities`,
    data,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}

// 4. UPDATE: Update existing entity
export const updateEntity = async (
  schoolId: string,
  id: string,
  data: UpdateEntityT,
): Promise<EntityT> => {
  const response = await apiClient.put<{ record: EntityT }>(
    `/api/v1/schools/${schoolId}/entities/${id}`,
    data,
  )
  return response.data.record  // ✅ Unwrap to return EntityT directly
}

// 5. DELETE: Delete entity
export const deleteEntity = async (
  schoolId: string,
  id: string,
): Promise<void> => {
  await apiClient.delete(`/api/v1/schools/${schoolId}/entities/${id}`)
  // ✅ No return value needed for delete operations
}
```

---

**Key Takeaways**:
- **List operations**: Return `PaginatedResponse<T>` directly (no unwrapping)
- **Single resource operations**: Unwrap `{ record: T }` to return `T` directly
- **Filter serialization**: Use `serializeFilter` from `@/lib/api/filter-utils` (see [reusable-patterns.mdc](reusable-patterns.mdc))
- **List query params**: Use `appendListParams` from `@/lib/api/query-params` for page, limit, search, sort, paging (see [reusable-patterns.mdc](reusable-patterns.mdc))
- **Query parameters**: Use `ListQueryParams` / `QueryStringT`-style interface for all list endpoints
- Always check API response structure (wrapped vs direct) before implementing
