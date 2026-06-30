---
trigger: model_decision
description: Layered error handling strategy for reliability
globs:
---

# Error Handling Strategy (Layered Defense)

Đảm bảo không gặp "White Screen of Death" bằng cách chia lớp phòng thủ.

## Layer 1: Network Errors (API)

- **Location**: `src/lib/api/apiClient.ts`
- **401**: Auto refresh token (handled by interceptor)
- **403**: Redirect to "Access Denied" or show toast error
- **5xx**: Toast "Hệ thống đang bảo trì, vui lòng thử lại"
- **Network Error**: Toast "Kết nối mạng không ổn định"
- **UI**: Use `sonner` (Shadcn toast component)

## Layer 2: Route Errors (Component Crash)

- **Location**: `errorComponent` in TanStack Router
- Route-level crashes don't affect sidebar/header
- Always provide "Try Again" button to retry loader

**Implementation**:

```typescript
export const Route = createRoute({
  // ...
  errorComponent: ({ error, reset }) => (
    <div>
      <p>Something went wrong</p>
      <button onClick={reset}>Try Again</button>
    </div>
  ),
})
```

## Layer 3: Global Errors (Fatal Crash)

- **Location**: `app/routes/__root.tsx`
- App-wide crashes show friendly "Oops! Something went wrong" page

## Layer 4: Form Errors (User Input)

- **Location**: TanStack Form + Zod validation
- Show errors inline below inputs
- **Never use toast** for form validation errors

**Zod Error Translation**:

- Zod v4 uses built-in locale system for automatic error message translation
- Configured in `src/lib/i18n/config.ts` to sync with i18next language
- Custom Vietnamese locale provides natural, user-friendly error messages
- Error messages automatically switch language when user changes language preference

**Implementation**:

```typescript
<Field
  name="email"
  validators={{ onChange: zodValidator(LoginSchema.shape.email) }}
>
  {(field) => (
    <>
      <Input {...field.getInputProps()} />
      {field.state.meta.errors && (
        <p className="text-red-500">{field.state.meta.errors[0]}</p>
      )}
    </>
  )}
</Field>
```

## Rules

- **ALWAYS** implement `errorComponent` for major routes (Dashboard, CourseDetail, etc.)
- Use `sonner` for API errors (Layer 1)
- Use inline text for form validation errors (Layer 4)
- Never use toast for form validation errors
- Always provide retry mechanism in error components

---

**Key Principle**: Errors should be handled at the appropriate layer. Network errors use toast, form errors use inline text, route errors use error components.
