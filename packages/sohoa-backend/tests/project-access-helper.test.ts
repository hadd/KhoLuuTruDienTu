import { assertEquals } from "@std/assert";
import { hasProjectScopedAccess } from "../modules/auth/project-access-scope.ts";

Deno.test("hasProjectScopedAccess is false for managed scope with no projects", () => {
    assertEquals(
        hasProjectScopedAccess({ type: "managed", projectCodes: [] }),
        false,
    );
});

Deno.test("hasProjectScopedAccess is true when user manages projects", () => {
    assertEquals(
        hasProjectScopedAccess({
            type: "managed",
            projectCodes: ["PRJ-001"],
        }),
        true,
    );
});

Deno.test("hasProjectScopedAccess is false for global scope", () => {
    assertEquals(
        hasProjectScopedAccess({ type: "global" }),
        false,
    );
});
