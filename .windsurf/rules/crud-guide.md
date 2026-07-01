---
trigger: model_decision
description: CRUD feature implementation patterns and checklist
globs:
---

# CRUD Feature Implementation Guide

Patterns và checklist để implement tính năng Create/Edit (Sheet hoặc Dialog) một cách nhất quán và tránh các lỗi phổ biến.

## Core Principles

1. **Form State Management**: Form hooks (`useAppForm` from `@/lib/forms`) chỉ khởi tạo `defaultValues` một lần khi mount. Dữ liệu async từ API sẽ không tự động cập nhật form.
2. **Loading States**: Phân biệt rõ 2 loại loading - fetch data vs submit form.
3. **API Response Wrapping**: Single resource APIs thường trả về `{ record: T }` thay vì `T` trực tiếp.
4. **UX Clarity**: Header cần rõ ràng, tránh duplicate content, hiển thị ID để hỗ trợ debug.

**Note:** For API client conventions (query parameters, filter serialization, response unwrapping), see [API Guide](api-guide.mdc).

## Implementation Checklist

### 1. API Client Setup

**Reference:** See [API Guide](api-guide.mdc) for complete API client conventions.

- [ ] **Follow API Conventions**
  - List operations: Use `QueryStringT` interface, serialize filters, return `PaginatedResponse<T>` directly
  - Detail operations: GET by ID returns `{ record: T }`, unwrap to `T`
  - Create operations: POST returns `{ record: T }`, unwrap to `T`
  - Update operations: PUT returns `{ record: T }`, unwrap to `T`
  - Delete operations: DELETE returns `void`
  - See [API Guide](api-guide.mdc) for detailed patterns and examples

### 2. Query & Loading State

- [ ] **Fetch Data in List Component**

  ```typescript
  // In List component (e.g., EntityList.tsx)
  const shouldFetchEntity = Boolean(schoolId && search.id)
  const { data: editingEntity, isLoading: isLoadingEntity } = useQuery({
    ...entityQueryOptions(schoolId || '', search.id || ''),
    enabled: shouldFetchEntity,
  })
  ```

- [ ] **Pass Loading State to Sheet/Dialog**
  ```typescript
  <EntitySheet
    open={sheetOpen}
    onOpenChange={handleSheetOpenChange}
    entity={shouldFetchEntity ? editingEntity : null}
    isLoadingData={shouldFetchEntity ? isLoadingEntity : false}
  />
  ```

### 3. Sheet/Dialog Component

- [ ] **Handle Loading State**
  - Show spinner khi `isLoadingData === true` (đang fetch data).
  - Không hiển thị form trống trong khi đang load.

  ```typescript
  {isLoadingData ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <EntityForm ... />
  )}
  ```

- [ ] **Header Structure**
  - **Create Mode**: Title only ("Create {Entity}").
  - **Edit Mode**: Title ("Edit {Entity}") + ID display (small, muted).
  - **Avoid**: Duplicate description text (không cần SheetDescription nếu chỉ lặp lại title).
  ```typescript
  <SheetHeader>
    <SheetTitle>
      {entity ? t('entity.form.editTitle') : t('entity.form.createTitle')}
    </SheetTitle>
    {entity && (
      <div className="mt-1 text-xs text-muted-foreground">
        ID: {entity.id}
      </div>
    )}
  </SheetHeader>
  ```

### 4. Form Component (CRITICAL)

- [ ] **Force Remount with Key Prop**
  - **MANDATORY**: Luôn truyền `key` prop vào Form component.
  - Key phải thay đổi khi entity ID thay đổi hoặc switch giữa create/edit mode.

  ```typescript
  // ✅ CORRECT: Force remount on ID change
  <EntityForm
    key={entity?.id ?? 'new'} // Critical: Forces remount
    entity={entity}
    onSubmit={handleSubmit}
    onCancel={handleCancel}
    isLoading={mutation.isPending}
  />

  // ❌ WRONG: Form won't update when entity changes
  <EntityForm
    entity={entity} // defaultValues only set once on mount
    onSubmit={handleSubmit}
  />
  ```

- [ ] **Why Key Prop is Required**
  - Form hooks (`useAppForm` from `@/lib/forms`) khởi tạo `defaultValues` một lần duy nhất.
  - Khi `entity` prop thay đổi từ `null` → `EntityT`, form không tự động re-initialize.
  - `key` prop force React unmount/remount component → form re-initializes với new `defaultValues`.

### 5. Mutation & Success Handling

- [ ] **Invalidate Queries on Success**
  ```typescript
  const mutation = useMutation({
    mutationFn: async (values: EntityForm) => {
      if (entity) {
        return await updateEntity(schoolId, entity.id, values)
      } else {
        return await createEntity(schoolId, values)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entitiesQueryKey(schoolId),
      })
      toast.success(
        entity
          ? t('entity.form.updateSuccess')
          : t('entity.form.createSuccess'),
      )
      onOpenChange(false)
    },
  })
  ```

## Common Pitfalls & Solutions

### Pitfall 1: Form Not Populating in Edit Mode

**Symptom**: Form fields are empty when editing, even though API returns data.

**Root Cause**: Form hook only initializes `defaultValues` once on mount. Async data arrives later.

**Solution**: Use `key={entity?.id ?? 'new'}` prop on Form component.

### Pitfall 2: API Response Type Mismatch

**Symptom**: TypeScript errors or runtime errors when accessing entity properties.

**Root Cause**: API returns `{ record: EntityT }` but code expects `EntityT` directly.

**Solution**: Unwrap response: `return response.data.record`

### Pitfall 3: Duplicate Header Content

**Symptom**: Header shows both title and description that say the same thing.

**Root Cause**: Using both `SheetTitle` and `SheetDescription` with redundant text.

**Solution**: Remove `SheetDescription` or use it only for truly additional context. Show ID instead.

### Pitfall 4: Empty Form Flash

**Symptom**: User sees empty form briefly before data loads.

**Root Cause**: Not showing loading state while fetching data.

**Solution**: Show spinner when `isLoadingData === true`, hide form until data is ready.

## Quick Reference Pattern

**Note:** For complete API client examples, see [API Guide](api-guide.mdc).

```typescript
// 1. List Component
const { data: editingEntity, isLoading: isLoadingEntity } = useQuery({
  ...entityQueryOptions(schoolId, id),
  enabled: Boolean(schoolId && id),
})

<EntitySheet
  entity={editingEntity}
  isLoadingData={isLoadingEntity}
/>

// 2. Sheet Component
{isLoadingData ? (
  <Loader2 className="animate-spin" />
) : (
  <EntityForm key={entity?.id ?? 'new'} entity={entity} />
)}

// 3. API Client patterns - See [API Guide](api-guide.mdc) for complete examples
```

---

**Key Takeaways**:

- Always use `key` prop on Form components when entity can change
- Always show loading state while fetching data
- Keep headers clean and informative (Title + ID, no duplicate descriptions)
- For API client patterns, see [API Guide](api-guide.mdc)
