import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { buildAccessPasswordPatch } from "../modules/security-level/access-password-patch.ts"

Deno.test("buildAccessPasswordPatch sets hash and enables password", async () => {
  const patch = await buildAccessPasswordPatch({
    accessPassword: "secret-1",
    existingVersion: 2,
  })
  assertEquals(patch.accessPasswordEnabled, true)
  assertEquals(typeof patch.accessPasswordHash, "string")
  assertEquals(patch.passwordVersion, 3)
})

Deno.test("buildAccessPasswordPatch clears password and bumps version", async () => {
  const patch = await buildAccessPasswordPatch({
    clearAccessPassword: true,
    existingHash: "existing",
    existingVersion: 4,
  })
  assertEquals(patch.accessPasswordEnabled, false)
  assertEquals(patch.accessPasswordHash, null)
  assertEquals(patch.passwordVersion, 5)
})

Deno.test("buildAccessPasswordPatch rejects enabled without hash", async () => {
  await assertRejects(
    () =>
      buildAccessPasswordPatch({
        accessPasswordEnabled: true,
        existingHash: null,
      }),
    Error,
    "Không thể bật mật khẩu khi chưa đặt mật khẩu.",
  )
})

Deno.test("buildAccessPasswordPatch requires current password for non-admin change", async () => {
  await assertRejects(
    () =>
      buildAccessPasswordPatch({
        accessPassword: "next",
        existingHash: "$2a$10$abcdefghijklmnopqrstuv",
        requireCurrentPassword: true,
        isAdmin: false,
      }),
    Error,
    "Phải nhập mật khẩu hiện tại để đổi hoặc xóa.",
  )
})
