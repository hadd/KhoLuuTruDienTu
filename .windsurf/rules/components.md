---
trigger: model_decision
description: Component architecture rules optimized for AI collaboration
globs:
---

# Component Architecture Rules (DevEx & AI Optimized)

Thiết kế để tối ưu khả năng hợp tác với AI Agent: "Dễ đọc, dễ tìm, dễ sửa".

## Component Classification

| Loại           | Vị trí                      | Mục đích                                            | Quy tắc cho AI                                                                           |
| :------------- | :-------------------------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Primitives** | `src/components/ui/*`       | Atomic (Button, Input). Based on Shadcn/ui.         | Cấm sửa logic. Chỉ sửa style qua variants. Copy-paste friendly.                          |
| **Common**     | `src/components/common/*`   | Molecules (DataTable, PageHeader). Domain-agnostic. | Phải nhận props linh hoạt (`className`, `children`). Không chứa hardcode business logic. |
| **Feature**    | `features/xxx/components/*` | Organisms (LoginForm, CourseCard). Business-heavy.  | Chứa logic gọi API, hardcode text (i18n keys).                                           |

## The "Rule of Three" (Quy tắc số 3)

**Quy tắc:** Đừng tạo Common Component quá sớm.

- **Lần 1:** Viết component ngay tại `features/A/components/Item.tsx`.
- **Lần 2:** Khi `features/B` cần dùng → Copy code từ A sang B (Duplication is cheaper than wrong abstraction).
- **Lần 3:** Khi `features/C` cũng cần → Refactor thành `components/common/Item.tsx`.

**Lý do:** AI Agent thường gặp khó khăn khi phải nhảy qua lại quá nhiều file abstract. Việc duplicate code ở giai đoạn đầu giúp AI hiểu context nhanh hơn (**"Locality of Behavior"**).

## Component File Structure (AI-Friendly)

Ưu tiên **Single File Component** trừ khi file quá lớn (>300 dòng). Giúp AI đọc 1 file là hiểu toàn bộ.

```typescript
// src/features/auth/components/LoginForm.tsx

// 1. IMPORTS
import { useAppForm, FormField } from '@/lib/forms'
// ...

// 2. TYPES (Colocated here, NOT in types/index.ts unless shared globally)
interface LoginFormProps {
  onSuccess: () => void;
  className?: string;
}

// 3. COMPONENT
export function LoginForm({ onSuccess, className }: LoginFormProps) {
  // Hooks
  // Logic
  return (
    <form>...</form>
  )
}

// 4. SUB-COMPONENTS (Small helpers only used here)
function FormFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-4">{children}</div>
}
```

### Rules

- Keep related Types inside the component file (Locality of Behavior)
- Only move types to `types/` if shared across multiple features
- Single file components preferred unless >300 lines

## Composition over Configuration

Tránh tạo "God Component" với hàng tá props boolean (`isEdit`, `isShowHeader`, `hasFooter`). Thay vào đó, dùng **Composition**.

**Bad** (Khó bảo trì, AI dễ nhầm):

```typescript
<Card title="Hi" showFooter={true} footerButton={<Btn />} onFooterClick={...} />
```

**Good** (Shadcn style - Dễ mở rộng):

```typescript
<Card>
  <CardHeader>Hi</CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Rules

- Use Composition (Slots/Children) over Configuration (Boolean props)
- Prefer component composition patterns (like Shadcn/ui)
- Avoid boolean flags that change component behavior significantly

## Visual Style System (AI Vocabulary)

Chúng ta cung cấp cho AI một Tập từ vựng (Vocabulary) chính xác để tránh việc AI "hallucinate" (bịa ra class không tồn tại).

### A. Approved Token Vocabulary (Copy-Paste for AI)

AI Agent chỉ được phép chọn class từ danh sách này cho cấu trúc chính.

- **Backgrounds:** `bg-background`, `bg-card`, `bg-popover`, `bg-muted` (phụ), `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent`.
- **Foregrounds (Text/Icon):** `text-foreground`, `text-card-foreground`, `text-popover-foreground`, `text-muted-foreground` (text mờ), `text-primary-foreground` (trên nền primary), `text-destructive-foreground`, `text-accent-foreground`.
- **Borders:** `border-border` (chung), `border-input` (input/select), `border-primary`, `border-destructive`.
- **Rings (Focus):** `ring-ring`.

### B. The "Escape Hatch" (Khi nào được phá luật?)

AI được phép dùng Utility Classes (VD: `text-blue-500`, `bg-emerald-100`) trong các trường hợp ngoại lệ sau:

- **Status Badges:** "Completed" (Green), "Pending" (Yellow), "Failed" (Red). Các trạng thái này mang ý nghĩa dữ liệu, không đổi theo theme.
- **Data Visualization:** Màu biểu đồ, màu tag phân loại.
- **Specific Branding:** Logo hoặc banner quảng cáo cố định màu.

## The Abstraction Rule: Components vs. Utilities

Để code gọn gàng và tránh sai sót, chúng ta phân tách rõ ràng:

### UI Primitives (USE COMPONENTS)

- **Cái gì:** Thành phần có style cụ thể (Màu, Bo góc, Viền).
- **Items:** Button, Input, Card, Badge, Dialog, Select.
- **Rule:** TUYỆT ĐỐI KHÔNG viết `<div className="bg-card rounded-xl border...">`. HÃY DÙNG `<Card>`.
- **Lợi ích:** Đảm bảo nhất quán 100%. Sửa 1 nơi cập nhật toàn app.

### Layout & Spacing (USE UTILITIES)

- **Cái gì:** Sắp xếp vị trí, khoảng cách.
- **Items:** `flex`, `grid`, `w-full`, `p-4`, `gap-2`, `mt-4`.
- **Rule:** KHÔNG abstract thành component kiểu `<Row>`, `<Spacer>`. HÃY DÙNG class Tailwind chuẩn.
- **Lợi ích:** Linh hoạt, không phải "phát minh lại HTML".

**Example:**

```typescript
// ✅ Correct
<div className="flex gap-4 p-4"> {/* Layout: Utilities */}
  <Card> {/* Primitive: Component */}
    <CardHeader>
       <Heading>Course Title</Heading>
    </CardHeader>
  </Card>
</div>
```

---

**Key Architecture Principles**:

- Locality of Behavior: Keep related code together
- Don't abstract to `common/` until used 3 times
- Single file components for better AI understanding
- **Abstraction**: Use Components for Primitives, Utilities for Layout
