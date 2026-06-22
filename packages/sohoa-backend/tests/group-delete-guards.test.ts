import { assertEquals } from "@std/assert";
import { AppError } from "@shared/common-lib";
import {
    GROUP_DELETE_BLOCKING_STATUSES,
    assertGroupDeleteAllowed,
} from "../modules/group/group-delete-guards.ts";
import { DossierStatus } from "../db/schemas/workflow-constants.ts";

Deno.test("GROUP_DELETE_BLOCKING_STATUSES — ENTRY_PROCESSING and all WAITING_CHECKER_N", () => {
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.ENTRY_PROCESSING), true);
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.WAITING_CHECKER_1), true);
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.WAITING_CHECKER_5), true);
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.READY_FOR_ENTRY), false);
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.APPROVED), false);
    assertEquals(GROUP_DELETE_BLOCKING_STATUSES.includes(DossierStatus.CHECKER_1_PROCESSING), false);
});

Deno.test("assertGroupDeleteAllowed — no-op when empty", () => {
    assertGroupDeleteAllowed([]);
});

Deno.test("assertGroupDeleteAllowed — throws conflict with details", () => {
    try {
        assertGroupDeleteAllowed([
            { status: DossierStatus.ENTRY_PROCESSING },
            { status: DossierStatus.WAITING_CHECKER_2 },
        ]);
        throw new Error("expected conflict");
    } catch (error) {
        assertEquals(error instanceof AppError, true);
        const appError = error as AppError;
        assertEquals(appError.status, 409);
        assertEquals(
            appError.message,
            "Không thể xóa nhóm khi còn hồ sơ đang nhập liệu hoặc chờ kiểm tra.",
        );
        assertEquals(
            (appError.details as { code: string; blockingCount: number; statuses: string[] }).code,
            "GROUP_HAS_BLOCKING_DOSSIERS",
        );
        assertEquals(
            (appError.details as { blockingCount: number }).blockingCount,
            2,
        );
    }
});
