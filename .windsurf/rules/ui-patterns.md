---
trigger: model_decision
description: Common UI patterns, layout rules, and interaction guidelines
globs:
---

# UI & Layout Patterns (UX Rules)

Các quy tắc về hành vi giao diện, layout và tương tác để đảm bảo tính nhất quán và trải nghiệm người dùng tốt nhất.

## Hierarchy (MOST IMPORTANT RULE)

**Philosophy:** Hierarchy guides user attention and decision-making. Every UI decision should reinforce what's most important. Visual, information, and interaction must align in priority.

**Core Principles:**

- **Visual**: Size, color, contrast, spacing create importance levels. Use semantic tokens strategically (primary for important, muted for secondary).
- **Information**: Primary content first, details follow (progressive disclosure). DOM order should match visual importance.
- **Interaction**: Primary actions prominent, secondary accessible but less prominent. Never give equal visual weight to primary and secondary actions.
- **Layout**: Follow natural scanning patterns (F/Z-pattern), important content top/left. Whitespace isolates important elements.

**Implementation Rule:** Before adding any UI element, ask "What's most important here?" and make it visually distinct. All patterns below support hierarchy—see references in each section.

## Common UI Behavioral Patterns

Quy định về hành vi tương tác để tránh lỗi "layout shift" và tăng tính tiện dụng.

### A. Overflow & Layout (App Shell Pattern)

**Hierarchy Note:** Layout hierarchy prevents scroll conflicts—primary content area is the only scrollable region.

Để tránh "Double Scrollbar" (thanh cuộn body + thanh cuộn table):

- **Viewport:** `h-screen w-full overflow-hidden` (Body không bao giờ cuộn).
- **Layout:** `flex` hoặc `grid` để chia vùng (Sidebar fixed, Header fixed).
- **Content Area:** Chỉ vùng nội dung chính được phép cuộn: `flex-1 overflow-y-auto`.
- **Modal:** Luôn dùng Portal, không render inline để tránh lỗi `overflow: hidden` của cha.

### B. URL State Rule (Deep Linking)

**Hierarchy Note:** Information hierarchy via URL visibility—important state (tabs, filters) persists and is shareable.

"If it changes the view, it goes in the URL." (Nếu nó thay đổi những gì user nhìn thấy, nó phải nằm trên URL).

- **Tabs:** `?tab=curriculum` (User refresh trang vẫn ở đúng tab).
- **Filters/Search:** `?q=react&level=beginner` (Share link cho người khác được).
- **Pagination:** `?page=2&limit=10`.
- **Dialogs (Optional):** `?action=edit-course&id=1` (Cho phép mở modal bằng link).
- **Anti-Pattern:** Dùng `useState` cho Tab/Filter quan trọng.

### C. Hierarchy & Stacking Context (Portal First)

**Hierarchy Note:** Visual hierarchy through stacking context—floating elements (dialogs, tooltips) must be above content layers.

Để tránh "Z-Index Wars" (Cuộc chiến layer `z-[99999]`):

- **Rule:** Bất kỳ UI nào "nổi" lên trên (Dropdown, Tooltip, Dialog, Toast) **BẮT BUỘC** dùng React Portal (đưa thẳng vào `document.body`).
- **Implementation:** Shadcn/Radix-UI đã mặc định làm việc này. Không được tự viết lại Dropdown bằng `position: absolute` thủ công trừ khi cực kỳ đơn giản.

### D. Interaction (Autofocus)

**Hierarchy Note:** Interaction hierarchy—focus the most important input first to guide user attention.

- **Search Pages:** Auto focus vào ô Search Input khi trang load.
- **Modals/Forms:** Auto focus vào ô nhập liệu đầu tiên (First Input).
- **Implementation:** Dùng prop `autoFocus` (React) hoặc `ref.current.focus()` trong `useEffect`.

## Detail Page Layout Pattern (Full-Height Pages)

Để tránh lỗi layout khi implement detail pages (chi tiết lớp học, chuẩn đầu ra, etc.) với full-height layout, cần tuân thủ pattern sau:

### 1. DashboardLayout Wrapper Rule (Tránh Double Wrap)

**CRITICAL:** Nếu parent route đã có `DashboardLayout` (dùng `<Outlet />`), child route **KHÔNG ĐƯỢC** wrap lại.

**Pattern Check:**

- **Parent route** (ví dụ: `learning-standards.tsx`): Có `DashboardLayout` với `<Outlet />`
- **Child route** (ví dụ: `learning-standards.$standardId.tsx`): **KHÔNG** wrap `DashboardLayout`, chỉ return feature component trực tiếp

**✅ CORRECT:**

```typescript
// Parent route: learning-standards.tsx
function LearningStandardsLayoutRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}

// Child route: learning-standards.$standardId.tsx
function LearningStandardDetailRoute() {
  return <LearningStandardDetail />  // ✅ No DashboardLayout wrapper
}
```

**❌ WRONG:**

```typescript
// Child route: learning-standards.$standardId.tsx
function LearningStandardDetailRoute() {
  return (
    <DashboardLayout>  // ❌ Double wrap! Parent already has DashboardLayout
      <LearningStandardDetail />
    </DashboardLayout>
  )
}
```

### 2. Full-Height Detail Page Pattern

Khi implement detail page component, sử dụng pattern sau để đạt full-height với scroll riêng:

**Container Structure:**

- **Outer container:** `flex flex-col overflow-hidden -m-6` với `height: calc(100vh - 4rem)`
  - `-m-6`: Break out khỏi padding `p-6` từ `DashboardLayout`
  - `calc(100vh - 4rem)`: Tính chiều cao chính xác (4rem = header height)
- **Content section:** `flex-1 overflow-y-auto min-h-0` (scrollable area)
- **Content width:** Use `w-full` (full width) instead of `max-w-*` constraints
- **Navigation:** Breadcrumbs in DashboardLayout handle navigation. No back button needed in detail pages.

**✅ CORRECT Pattern:**

```typescript
export function EntityDetail() {
  return (
    <div className="flex flex-col overflow-hidden -m-6" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Content Section (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full px-6 py-8">
          <Card>
            <CardHeader>...</CardHeader>
            <CardContent>...</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

**Note:** Navigation is handled by breadcrumbs in the DashboardLayout. No back button needed in the detail page header.

**Reference Examples:**

- `src/features/classes/components/ClassDetail.tsx` - Pattern đúng với tabs
- `src/features/learning-standards/components/LearningStandardDetail.tsx` - Pattern đúng với form

### 3. Anti-Patterns (KHÔNG ĐƯỢC LÀM)

- **❌ Double wrap `DashboardLayout`:** Nếu parent đã có, child không được wrap lại
- **❌ Dùng `h-full` mà không break padding:** Sẽ bị overflow do padding `p-6` từ `DashboardLayout`
- **❌ Để content scroll ở body level:** Phải có scroll riêng trong content section
- **❌ Quên `min-h-0`:** Cần `min-h-0` để flex child có thể shrink nhỏ hơn content

**❌ WRONG Examples:**

```typescript
// ❌ Wrong: Double wrap
function DetailRoute() {
  return (
    <DashboardLayout>  // Parent already has this!
      <DetailComponent />
    </DashboardLayout>
  )
}

// ❌ Wrong: h-full without breaking padding
<div className="h-full">  // Will overflow due to p-6 from DashboardLayout
  <Content />
</div>

// ❌ Wrong: No scroll container
<div className="flex-1">  // Missing overflow-y-auto and min-h-0
  <LongContent />
</div>
```

### 4. Rule cho AI Agent

Khi tạo detail page mới:

1. **Check parent route:** Xem parent có `DashboardLayout` với `<Outlet />` không
2. **Route component:** Nếu parent đã có layout, chỉ return feature component (không wrap `DashboardLayout`)
3. **Feature component:** Luôn dùng pattern `-m-6` + `calc(100vh - 4rem)` + content scrollable với `w-full`
4. **Navigation:** Breadcrumbs handle navigation - no back button needed
5. **Reference:** Copy pattern từ `LearningStandardDetail.tsx`

## Sheet / Dialog Pattern (BẮT BUỘC CHO FORM CRUD)

**IMPORTANT:** For all CRUD Sheet components (create/edit forms), **ALWAYS use the `EntitySheet` component** from `@/components/common/EntitySheet` instead of manually implementing Sheet structure.

**See [Reusable Patterns Guide](reusable-patterns.mdc) for complete `EntitySheet` usage documentation.**

**Quick Reference:**

- **Location**: `src/components/common/EntitySheet.tsx`
- **Purpose**: Reusable Sheet wrapper that handles layout, loading states, header with ID display, and form key management
- **When to Use**: Always when creating Sheet components for entity create/edit forms
- **Key Features**: Automatic form key management, consistent loading states, ID display in edit mode

**✅ CORRECT: Use EntitySheet component**

```typescript
import { EntitySheet } from '@/components/common/EntitySheet'

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
```

**❌ WRONG: Manual Sheet implementation**

- Do NOT manually implement Sheet structure with `SheetContent`, `SheetHeader`, etc.
- Do NOT duplicate the Sheet layout pattern - use `EntitySheet` component instead

**Rule cho AI:**

- Khi tạo Sheet mới (vd `StudentSheet`, `CategorySheet`), **phải dùng `EntitySheet` component** thay vì tự implement Sheet structure.
- Xem [reusable-patterns.mdc](reusable-patterns.mdc) để biết cách sử dụng đầy đủ.

## Status Badge Guidelines

**IMPORTANT:** For all status badge displays, **ALWAYS use the `StatusBadge` component** from `@/components/common/StatusBadge`.

**See [UI Components Guide](ui-components.mdc) for complete `StatusBadge` usage documentation.**

**Quick Reference:**

- **Location**: `@/components/common/StatusBadge`
- **When to Use**: Always for displaying entity statuses (published, draft, pending, etc.)
- **Key Rule**: Never hardcode status badge styles - always use `StatusBadge` component
- **Available Status Values**: `draft`, `active`, `published`, `archived`, `inactive`, `closed`, `pending`, `submitted`, `graded`, etc.

**✅ CORRECT: Use StatusBadge component**

```typescript
import { StatusBadge } from '@/components/common/StatusBadge'

<StatusBadge status="published" />
<StatusBadge status="pending" includeBorder />
```

**❌ WRONG: Hardcoded badge styles**

- Do NOT use `<Badge className="bg-emerald-100">Published</Badge>`
- Do NOT create custom status badge helpers
- Do NOT use `getStatusBadgeClass` directly in components - use `StatusBadge` component instead

---

**Key UI Principles**:

- **Hierarchy First**: Visual, information, and interaction must align in priority (see Hierarchy section above)
- **Sync State to URL**: Tabs, Filters, Search MUST be in URL
- **Think in Layers**: Background -> Card -> Popover (Semantic tokens only)
- **Abstraction**: Use Utilities for Layout, Components for Primitives
