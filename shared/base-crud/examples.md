# Base CRUD Router Examples

This document provides comprehensive examples of how to use the Base CRUD Router with filtering, pagination, and sorting capabilities.

## Basic Usage

```typescript
import { createCrudRouter } from "@shared/base-crud";

// Minimal setup - everything else is auto-generated!
const router = createCrudRouter({
    basePath: "/todos",
    service: todoService,
    schemas: {
        createBody: todoCreateSchema,
        updateBody: todoUpdateSchema,
    },
});
```

## Query Parameters

### Pagination

```bash
# Basic pagination
GET /todos?page=1&limit=10

# Large page size (max 400)
GET /todos?page=2&limit=50
```

### Sorting

```bash
# Sort by single field (ascending by default)
GET /todos?sort=title

# Sort by single field descending
GET /todos?sort=title:desc

# Sort by multiple fields
GET /todos?sort=isDone:asc,createdAt:desc

# Sort by date fields
GET /todos?sort=createdAt:desc,updatedAt:asc
```

### Text Search

```bash
# Search across text fields
GET /todos?search=shopping

# Search with pagination
GET /todos?search=work&page=1&limit=20
```

### Filtering

The filtering system uses bracket notation for complex queries:

#### Relation Filtering (Advanced)

You can filter and sort by fields in related tables using dot notation. This requires configuring `relationTables` in your service.

```typescript
// Service configuration example
const enrollmentService = createCrudService({
    db,
    table: studentClassEnrollments,
    defaultWith: { student: true, schoolClass: true },
    relationTables: {
        student: students,
        schoolClass: schoolClass,
    },
    // ... other options
});
```

Once configured, you can use dot notation in filters and sorts:

```bash
# Filter by related table fields
GET /enrollments?filter[student.createdAt][$gte]=2024-01-01

# Filter by multiple relation fields
GET /enrollments?filter[student.status][$eq]=active&filter[schoolClass.grade][$eq]=10

# Sort by relation fields
GET /enrollments?sort=student.name:asc,createdAt:desc

# Combine relation filters with local filters
GET /enrollments?filter[status][$eq]=active&filter[student.createdAt][$gte]=2024-01-01&sort=student.name:asc
```

**How it works:**
- The system automatically performs LEFT JOINs when filtering/sorting by relation fields
- Foreign key inference: It assumes `relationName + "Id"` (e.g., `studentId` for `student` relation)
- Uses Drizzle's query builder for type-safe joins
- Results still include full relation data via `defaultWith`

#### Basic Field Filters

```bash
# Exact match
GET /todos?filter[title][$eq]=Buy groceries

# Not equal
GET /todos?filter[isDone][$eq]=false

# Greater than or equal
GET /todos?filter[createdAt][$gte]=2024-01-01

# Less than
GET /todos?filter[priority][$lt]=5

# In array
GET /todos?filter[status][$in]=active,pending

# Not in array
GET /todos?filter[category][$nin]=archived,deleted
```

#### Complex Filtering

```bash
# Multiple conditions (AND)
GET /todos?filter[isDone][$eq]=false&filter[priority][$gte]=3

# Date range filtering
GET /todos?filter[createdAt][$gte]=2024-01-01&filter[createdAt][$lt]=2024-02-01

# Status filtering with multiple values
GET /todos?filter[status][$in]=active,pending,review
```

#### Logical Operators

```bash
# AND conditions (implicit)
GET /todos?filter[isDone][$eq]=false&filter[priority][$gte]=3

# OR conditions using bracket notation
GET /todos?filter[$or][0][title][$eq]=urgent&filter[$or][1][priority][$gte]=5

# Complex AND/OR combinations
GET /todos?filter[$and][0][isDone][$eq]=false&filter[$and][1][$or][0][priority][$gte]=3&filter[$and][1][$or][1][title][$eq]=urgent
```

### Debug Mode

```bash
# Include debug information in response
GET /todos?debug=true

# Debug with filtering
GET /todos?filter[isDone][$eq]=false&debug=true
```

## Response Format

### List Response

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "title": "Buy groceries [server-tag]",
        "description": "Get milk, bread, and eggs",
        "isDone": false,
        "tags": ["shopping", "urgent"],
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "page": 1,
    "totalPages": 5,
    "limit": 50,
    "total": 250,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "query": {
      "page": 1,
      "limit": 50,
      "filter": {
        "isDone": { "$eq": false }
      }
    }
  }
}
```

### Error Response

```json
{
  "error": "Invalid filter operator: $invalid",
  "query": {
    "filter": {
      "title": { "$invalid": "test" }
    }
  }
}
```

## Complete Examples

### Example 1: Get Active High-Priority Todos

```bash
GET /todos?filter[isDone][$eq]=false&filter[priority][$gte]=3&sort=priority:desc,createdAt:asc&limit=20
```

### Example 2: Search and Filter by Date Range

```bash
GET /todos?search=meeting&filter[createdAt][$gte]=2024-01-01&filter[createdAt][$lt]=2024-02-01&sort=createdAt:desc
```

### Example 3: Complex Filtering with OR Logic

```bash
GET /todos?filter[$or][0][title][$eq]=urgent&filter[$or][1][priority][$gte]=5&sort=createdAt:desc&page=1&limit=10
```

### Example 4: Debug Query

```bash
GET /todos?filter[tags][$in]=shopping,work&sort=title:asc&debug=true
```

## Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal to | `filter[name][$eq]=John` |
| `$in` | In array | `filter[status][$in]=active,pending` |
| `$nin` | Not in array | `filter[category][$nin]=archived` |
| `$gte` | Greater than or equal | `filter[age][$gte]=18` |
| `$lte` | Less than or equal | `filter[price][$lte]=100` |
| `$gt` | Greater than | `filter[score][$gt]=80` |
| `$lt` | Less than | `filter[count][$lt]=5` |

## Best Practices

1. **Use pagination** for large datasets to improve performance
2. **Combine filters** to narrow down results effectively
3. **Use sorting** to get consistent, ordered results
4. **Enable debug mode** during development to understand query parsing
5. **Use appropriate operators** for different data types (strings, numbers, dates)
6. **Test complex queries** with debug mode to verify parsing

## Integration with Swagger

The router automatically generates comprehensive Swagger documentation with:
- Interactive query parameter examples
- Response schema definitions
- Error response documentation
- Filter operator descriptions
- Pagination parameter validation

Access the documentation at `/docs` when using the swagger plugin.
