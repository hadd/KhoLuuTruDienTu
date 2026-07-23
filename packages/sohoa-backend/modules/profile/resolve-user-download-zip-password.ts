import { and, eq, isNull } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { decryptPassword } from "../../libs/email-crypto.ts";

/**
 * Resolve ZIP password from the downloading user's personal download password.
 * Returns undefined when watermark is off or user has no enabled password.
 */
export async function resolveUserDownloadZipPassword(
    userId: string,
    applyWatermark: boolean,
): Promise<string | undefined> {
    if (!applyWatermark) return undefined;
    if (!userId?.trim()) return undefined;

    const profile = await db.query.userProfiles.findFirst({
        where: and(
            eq(userProfiles.id, userId),
            isNull(userProfiles.deletedAt),
        ),
        columns: {
            id: true,
            downloadPasswordEnabled: true,
            downloadPasswordEncrypted: true,
        },
    });

    if (
        !profile?.downloadPasswordEnabled ||
        !profile.downloadPasswordEncrypted
    ) {
        return undefined;
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
