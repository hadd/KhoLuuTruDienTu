import { and, eq, isNull } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { decryptPassword } from "../../libs/email-crypto.ts";

/**
 * Resolve ZIP password from the downloading user's personal download PIN.
 * Only when encryptDownload (security level `permission.encrypt_download`) is true.
 * Having downloadPasswordEncrypted is enough — watermark / user enable toggle are not gates.
 *
 * @param _applyWatermark - unused (kept for call-site compatibility)
 * @param encryptDownload - when true, PIN ciphertext is required and used as ZIP password
 */
export async function resolveUserDownloadZipPassword(
    userId: string,
    _applyWatermark: boolean,
    encryptDownload: boolean = false,
): Promise<string | undefined> {
    if (!encryptDownload) return undefined;
    if (!userId?.trim()) return undefined;

    const profile = await db.query.userProfiles.findFirst({
        where: and(
            eq(userProfiles.id, userId),
            isNull(userProfiles.deletedAt),
        ),
        columns: {
            id: true,
            downloadPasswordEncrypted: true,
        },
    });

    if (!profile?.downloadPasswordEncrypted) {
        throw httpError.forbidden(
            "Cấp độ bảo mật này yêu cầu mã hóa tài liệu. Vui lòng đặt mã PIN cá nhân trước khi tải xuống.",
        );
    }

    try {
        return await decryptPassword(profile.downloadPasswordEncrypted);
    } catch (err) {
        logApi.error(
            { err, userId: profile.id },
            "[export] Failed to decrypt user download ZIP password",
        );
        throw httpError.internal(
            "Không giải mã được mật khẩu tải xuống của người dùng",
        );
    }
}
