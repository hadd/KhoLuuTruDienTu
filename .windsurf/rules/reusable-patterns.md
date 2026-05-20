---
trigger: model_decision
description: Reusable code patterns and utilities for common operations
globs:
---
# Reusable Patterns Guide

This guide documents reusable utilities and components that should be used instead of duplicating code. These patterns have been extracted from common code duplication across the codebase.

## Core Principle: DRY (Don't Repeat Yourself)

**NEVER duplicate these patterns** - always use the shared utilities and components documented below.

## 1. List Query Params Utility

### Location
`src/lib/api/query-params.ts`

### Purpose
Appends standard list query parameters (page, limit, search, sort, paging) to a `URLSearchParams` instance. Use this for all list API endpoints instead of manually calling `searchParams.set()` for each param.

### Usage

**✅ CORRECT: Import and use the utility**
```typescript
import { appendListParams } from '@/lib/api/query-params'

const searchParams = new URLSearchParams()
appendListParams(searchParams, params)
// Then add filter via serializeFilter if needed, and any endpoint-specific params (e.g. gradeId, order)
```

**Type:** `ListQueryParams` is exported for typing list params: `page?`, `limit?`, `search?`, `sort?`, `paging?`.

**❌ WRONG: Duplicating the logic**
```typescript
// DON'T DO THIS - use appendListParams instead
if (params?.page) searchParams.set('page', String(params.page))
if (params?.limit) searchParams.set('limit', String(params.limit))
// ...
```

### When to Use
- **Always** when building query strings for list/paginated endpoints
- For endpoint-specific params (e.g. `gradeId`, `order`, `direction`), add 1–2 manual `searchParams.set()` calls after `appendListParams`

## 2. Filter Serialization Utility

### Location
`src/lib/api/filter-utils.ts`

### Purpose
Serializes filter objects to URL query parameters using bracket notation for API requests.

### Usage

**✅ CORRECT: Import and use the utility**
```typescript
import { appendListParams } from '@/lib/api/query-params'
import { serializeFilter } from '@/lib/api/filter-utils'

export const getEntities = async (
  schoolId: string,
  params?: {
    page?: number
    limit?: number
    search?: string
    filter?: unknown
    sort?: string
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
  return response.data
}
```

**❌ WRONG: Duplicating the function**
```typescript
// DON'T DO THIS - the function already exists in filter-utils.ts
function serializeFilter(
  searchParams: URLSearchParams,
  filter: Record<string, unknown>,
  prefix = 'filter',
): void {
  // ... duplicate implementation
}
```

### When to Use
- **Always** when implementing list API endpoints that accept filter parameters
- Used in all `get*` functions in API client files (together with `appendListParams`)

## 3. Form Field Validation Utility

### Location
`src/lib/utils/form-validation.ts`

### Purpose
Extracts the first validation error message from a Zod schema validation result.

### Usage

**✅ CORRECT: Use the new form system - FormField handles validation automatically**
```typescript
import { useAppForm, FormField } from '@/lib/forms'
import { EntitySchema } from '../schemas'

const form = useAppForm({
  schema: EntitySchema,
  defaultValues: { name: '' },
  onSubmit: async ({ value }) => { /* ... */ },
})

return <FormField form={form} name="name" label={t('entity.form.name')} />
```

**❌ WRONG: Duplicating the function**
```typescript
// DON'T DO THIS - the function already exists in form-validation.ts
const getFieldError = (schema: ZodTypeAny, value: unknown) => {
  const result = schema.safeParse(value)
  if (!result.success) {
    return result.error.issues[0]?.message ?? 'Invalid value'
  }
}
```

### When to Use
- **Note**: `getFieldError` is used internally by `FormField` component
- **For direct usage**: Only needed when building custom field validators (rare)
- **For standard forms**: Use `FormField` from `@/lib/forms` which handles validation automatically

### Notes
- Zod error messages are automatically translated via Zod v4's built-in locale system
- The utility returns `undefined` if validation passes, or a string error message if it fails
- No need to pass translation function - Zod handles i18n automatically

## 4. Required Field Mark Component

### Location
`src/components/common/RequiredMark.tsx`

### Purpose
Displays a red asterisk (*) to indicate required form fields.

### Usage

**✅ CORRECT: FormField automatically shows RequiredMark for required fields**
```typescript
import { useAppForm, FormField } from '@/lib/forms'

const form = useAppForm({
  schema: EntitySchema,
  defaultValues: { name: '' },
  onSubmit: async ({ value }) => { /* ... */ },
})

// FormField automatically detects required status and shows RequiredMark
return <FormField form={form} name="name" label={t('entity.form.name')} />
```

**❌ WRONG: Duplicating the component**
```typescript
// DON'T DO THIS - the component already exists
function RequiredMark() {
  return <span className="text-destructive">*</span>
}
```

### When to Use
- **Always** when displaying required field indicators in form labels
- Use in conjunction with form field labels

## 5. Entity Sheet Wrapper Component

### Location
`src/components/common/EntitySheet.tsx`

### Purpose
Reusable Sheet wrapper component for entity create/edit forms. Handles:
- Sheet layout and structure
- Loading state display
- Header with title and ID display
- Form key management (forces remount on entity change)

### Usage

**✅ CORRECT: Use EntitySheet wrapper**
```typescript
import { EntitySheet } from '@/components/common/EntitySheet'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function EntitySheet({
  open,
  onOpenChange,
  entity,
  isLoadingData = false,
}: EntitySheetProps) {
  const schoolId = useCurrentSchool()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: EntityFormValues) => {
      if (!schoolId) throw new Error('School ID is required')
      if (entity) {
        return await updateEntity(schoolId, entity.id, values)
      } else {
        return await createEntity(schoolId, values)
      }
    },
    onSuccess: () => {
      if (schoolId) {
        queryClient.invalidateQueries({
          queryKey: entitiesQueryKey(schoolId),
        })
      }
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'An error occurred')
    },
  })

  const handleSubmit = async (values: EntityFormValues) => {
    await mutation.mutateAsync(values)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      entity={entity ?? null}
      isLoadingData={isLoadingData}
      createTitleKey="entities.form.createTitle"
      editTitleKey="entities.form.editTitle"
      namespace="school"
    >
      <EntityForm
        key={entity?.id ?? 'new'}
        entity={entity}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={mutation.isPending}
      />
    </EntitySheet>
  )
}
```

**❌ WRONG: Duplicating Sheet structure**
```typescript
// DON'T DO THIS - use EntitySheet instead
return (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="flex flex-col w-full sm:max-w-lg p-0">
      <SheetHeader className="px-6 pt-6 pb-4 border-b">
        <SheetTitle>
          {entity ? t('entity.form.editTitle') : t('entity.form.createTitle')}
        </SheetTitle>
        {entity && (
          <div className="mt-1 text-xs text-muted-foreground">
            ID: {entity.id}
          </div>
        )}
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <EntityForm key={entity?.id ?? 'new'} {...props} />
        )}
      </div>
    </SheetContent>
  </Sheet>
)
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls Sheet open/close state |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when Sheet state changes |
| `entity` | `TEntity \| null` | Yes | Entity object (null for create mode) |
| `isLoadingData` | `boolean` | No | Shows loading spinner when fetching entity data |
| `createTitleKey` | `string` | Yes | i18n key for create mode title |
| `editTitleKey` | `string` | Yes | i18n key for edit mode title |
| `namespace` | `string` | No | i18n namespace (default: 'school') |
| `maxWidth` | `'sm' \| 'md' \| 'lg' \| 'xl'` | No | Sheet max width (default: 'lg') |
| `children` | `React.ReactNode` | Yes | Form component to render |

### When to Use
- **Always** when creating Sheet components for entity create/edit forms
- Replaces manual Sheet structure implementation
- Ensures consistent layout, loading states, and form key management

### Key Features
- **Automatic form key management**: Always use `key={entity?.id ?? 'new'}` on the form component inside EntitySheet
- **Consistent loading states**: Handles loading spinner display automatically
- **ID display**: Automatically shows entity ID in edit mode
- **Responsive width**: Configurable max width for different form sizes

## Checklist for New Features

When implementing a new CRUD feature, ensure you:

- [ ] **Use `appendListParams`** from `@/lib/api/query-params` for list query params (page, limit, search, sort, paging)
- [ ] **Use `serializeFilter`** from `@/lib/api/filter-utils` in API client list functions when filters are needed
- [ ] **Use `getFieldError`** from `@/lib/utils/form-validation` in form field validators
- [ ] **Use `RequiredMark`** from `@/components/common/RequiredMark` for required field indicators
- [ ] **Use `EntitySheet`** from `@/components/common/EntitySheet` for create/edit Sheet components
- [ ] **Never duplicate** these utilities or components

## Migration Guide

If you find duplicate code matching these patterns:

1. **For list query params**: Replace manual `searchParams.set('page', ...)` etc. with `appendListParams(searchParams, params)` from `@/lib/api/query-params`
2. **For `serializeFilter`**: Remove the duplicate function and import from `@/lib/api/filter-utils`
3. **For `getFieldError`**: Remove the duplicate function and import from `@/lib/utils/form-validation`
4. **For `RequiredMark`**: Remove the duplicate component and import from `@/components/common/RequiredMark`
5. **For Sheet components**: Refactor to use `EntitySheet` wrapper component

## Related Guides

- [API Guide](api-guide.mdc) - API client conventions and patterns
- [CRUD Guide](crud-guide.mdc) - Complete CRUD feature implementation checklist
- [Data and Forms](data-and-forms.mdc) - Form validation and data handling patterns
