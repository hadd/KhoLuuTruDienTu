import { httpError } from "@shared/common-lib"
import { hashPassword } from "../../libs/helpers/password.ts"

export type AccessPasswordPatchInput = {
  accessPassword?: string
  clearAccessPassword?: boolean
  accessPasswordEnabled?: boolean
  currentPassword?: string
  /** Khi true và đang đổi/xóa, bắt buộc currentPassword nếu đã có hash (trừ admin). */
  requireCurrentPassword?: boolean
  isAdmin?: boolean
  existingHash?: string | null
  existingEnabled?: boolean
  existingVersion?: number
}

export type AccessPasswordPatch = {
  accessPasswordEnabled?: boolean
  accessPasswordHash?: string | null
  passwordVersion?: number
}

/**
 * Chuẩn hóa set/replace/clear mật khẩu riêng.
 * - clear / enabled=false → xóa hash
 * - plaintext → hash + enabled
 * - enabled=true mà thiếu hash → lỗi
 */
export async function buildAccessPasswordPatch(
  input: AccessPasswordPatchInput,
): Promise<AccessPasswordPatch> {
  const existingHash = input.existingHash ?? null
  const existingVersion = input.existingVersion ?? 1
  const changing =
    Boolean(input.clearAccessPassword) ||
    input.accessPasswordEnabled === false ||
    Boolean(input.accessPassword)

  if (
    changing &&
    input.requireCurrentPassword &&
    !input.isAdmin &&
    existingHash
  ) {
    if (!input.currentPassword) {
      throw httpError.badRequest("Phải nhập mật khẩu hiện tại để đổi hoặc xóa.")
    }
    const { verifyPassword } = await import("../../libs/helpers/password.ts")
    const ok = await verifyPassword(input.currentPassword, existingHash)
    if (!ok) {
      throw httpError.badRequest("Mật khẩu hiện tại không đúng.")
    }
  }

  if (input.clearAccessPassword === true || input.accessPasswordEnabled === false) {
    return {
      accessPasswordEnabled: false,
      accessPasswordHash: null,
      passwordVersion: existingVersion + 1,
    }
  }

  if (input.accessPassword) {
    const trimmed = input.accessPassword.trim()
    if (!trimmed) {
      throw httpError.badRequest("Mật khẩu không được để trống.")
    }
    return {
      accessPasswordEnabled: true,
      accessPasswordHash: await hashPassword(trimmed),
      passwordVersion: existingVersion + 1,
    }
  }

  if (input.accessPasswordEnabled === true) {
    if (!existingHash) {
      throw httpError.badRequest(
        "Không thể bật mật khẩu khi chưa đặt mật khẩu.",
      )
    }
    return { accessPasswordEnabled: true }
  }

  return {}
}
