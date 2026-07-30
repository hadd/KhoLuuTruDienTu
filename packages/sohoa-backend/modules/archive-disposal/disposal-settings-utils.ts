import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";

import { db } from "../../db/db-conn.ts";
import { DISPOSAL_SETTINGS_SINGLETON_ID } from "../../db/schemas/archive-disposal-constants.ts";
import { disposalSettings } from "../../db/schemas/archive-disposal.ts";

export async function getDisposalSettingsRow() {
    const [row] = await db.select().from(disposalSettings)
        .where(eq(disposalSettings.id, DISPOSAL_SETTINGS_SINGLETON_ID))
        .limit(1);
    if (row) return row;

    const [inserted] = await db.insert(disposalSettings).values({
        id: DISPOSAL_SETTINGS_SINGLETON_ID,
        councilReviewEnabled: true,
    }).onConflictDoNothing().returning();

    if (inserted) return inserted;

    const [existing] = await db.select().from(disposalSettings)
        .where(eq(disposalSettings.id, DISPOSAL_SETTINGS_SINGLETON_ID))
        .limit(1);
    return existing!;
}

export async function assertCouncilReviewWorkflowEnabled() {
    const settings = await getDisposalSettingsRow();
    if (!settings.councilReviewEnabled) {
        throw httpError.conflict(
            "Quy trình Hội đồng thẩm tra đang tắt — không thể thao tác danh mục đề xuất hủy",
        );
    }
}
