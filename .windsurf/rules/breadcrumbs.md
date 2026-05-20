---
trigger: model_decision
description: Breadcrumb implementation patterns for routes
globs:
---
# Breadcrumb Rules

- **Usage:** Breadcrumbs are automatically generated based on the `staticData` property of each route.
- **Implementation:**
  - When creating a new route in `src/app/routes/`, **ALWAYS** add a `crumb` property to `staticData`.
  - **Simple Breadcrumb:**
    ```typescript
    export const Route = createFileRoute('/dashboard/users')({
      staticData: {
        crumb: 'Users',
      },
      // ...
    })
    ```
  - **Dynamic Breadcrumb:** (e.g., using data from loader)
    ```typescript
    export const Route = createFileRoute('/dashboard/users/$userId')({
      staticData: {
        crumb: (data) => data.user.name, // Access loaderData
      },
      loader: async () => { ... },
      // ...
    })
    ```
- **Placement:** The `<AppBreadcrumb />` component is already integrated into `DashboardHeader`. Do NOT add it manually to your page components unless you are creating a completely custom layout.
- **Translation:** For static crumbs, prefer passing the raw string (or i18n key if we switch to translating in the component). Currently, pass the display string directly.
