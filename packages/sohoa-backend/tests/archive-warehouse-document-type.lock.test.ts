import { assertEquals, assertRejects } from "@std/assert";
import { AppError } from "@shared/common-lib";
import type { UserWithRoles } from "../libs/plugins/auth-profile.ts";
import { ArchiveWarehouseService } from "../modules/archive/archive-warehouse-service.ts";

Deno.test("updateFileDocumentType rejects changes for archived warehouse files", async () => {
  const profile = { id: crypto.randomUUID() } as UserWithRoles;

  const error = await assertRejects(
    () =>
      ArchiveWarehouseService.updateFileDocumentType(profile, {
        dossierId: crypto.randomUUID(),
        fileId: crypto.randomUUID(),
        documentTypeId: "some-type",
      }),
    AppError,
  ) as AppError;

  assertEquals(error.status, 409);
  assertEquals(
    error.message,
    "Không thể chỉnh sửa loại tài liệu từ kho lưu trữ",
  );
});
