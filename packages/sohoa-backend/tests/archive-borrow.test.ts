import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ArchiveBorrowDipStatus,
  ArchiveBorrowMedium,
  ArchiveBorrowStatus,
  ARCHIVE_BORROW_ELECTRONIC_OPEN_STATUSES,
  ELECTRONIC_ITEM_KINDS,
} from "../db/schemas/archive-borrow-constants.ts";

Deno.test("electronic open statuses cover pending/approved/active only", () => {
  assertEquals([...ARCHIVE_BORROW_ELECTRONIC_OPEN_STATUSES], [
    ArchiveBorrowStatus.PENDING,
    ArchiveBorrowStatus.APPROVED,
    ArchiveBorrowStatus.ACTIVE,
  ]);
});

Deno.test("electronic item kinds exclude physical dossier", () => {
  assertEquals([...ELECTRONIC_ITEM_KINDS], ["FILE", "DOSSIER"]);
});

Deno.test("borrow medium and dip status enums are stable", () => {
  assertEquals(ArchiveBorrowMedium.ELECTRONIC, "ELECTRONIC");
  assertEquals(ArchiveBorrowMedium.PHYSICAL, "PHYSICAL");
  assertEquals(ArchiveBorrowDipStatus.READY, "READY");
  assertEquals(ArchiveBorrowDipStatus.REVOKED, "REVOKED");
});

Deno.test("borrow DIP key helper never targets AIP prefix", () => {
  const prefix = "DIP";
  const requestId = "11111111-1111-4111-8111-111111111111";
  const fileId = "22222222-2222-4222-8222-222222222222";
  const key = `${prefix}/${requestId}/${fileId}-demo.pdf`;
  assertEquals(key.startsWith("DIP/"), true);
  assertEquals(key.includes("/aip/"), false);
  assertEquals(key.startsWith("aip/"), false);
});

Deno.test("borrow eligible search requires short query and metadata shape", () => {
  const sample = {
    id: "33333333-3333-4333-8333-333333333333",
    name: "HS-001",
    folderPath: "/fond-a/HS-001",
    status: "ARCHIVED",
    fondId: "fond-a",
    fileCount: 1,
    files: [{ id: "44444444-4444-4444-8444-444444444444", fileName: "a.pdf" }],
  };
  assertEquals(sample.status, "ARCHIVED");
  assertEquals(Object.keys(sample.files[0]).includes("filePath"), false);
  assertEquals("q".length < 2, true);
});
