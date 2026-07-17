import { assertEquals } from "@std/assert";
import { buildPdfPermissionFlags } from "../libs/watermark/pdf-security.ts";

Deno.test("buildPdfPermissionFlags sets print and accessibility bits when allowed", () => {
  const perms = buildPdfPermissionFlags({
    allowPrinting: true,
    allowChanging: false,
    allowDocumentAssembly: false,
    allowContentCopying: false,
    allowContentCopyingAccessibility: true,
    allowPageExtraction: false,
    allowCommenting: false,
    allowFormFilling: true,
    allowSigning: false,
  });

  // Signed 32-bit; compare via unsigned bits
  const u = perms >>> 0;
  assertEquals((u & 4) !== 0, true); // print
  assertEquals((u & 2048) !== 0, true); // print HQ
  assertEquals((u & 8) !== 0, false); // modify
  assertEquals((u & 16) !== 0, false); // copy
  assertEquals((u & 512) !== 0, true); // accessibility
  assertEquals((u & 256) !== 0, true); // form fill
});

Deno.test("buildPdfPermissionFlags ORs copy when page extraction allowed", () => {
  const perms = buildPdfPermissionFlags({
    allowPrinting: false,
    allowChanging: false,
    allowDocumentAssembly: false,
    allowContentCopying: false,
    allowContentCopyingAccessibility: false,
    allowPageExtraction: true,
    allowCommenting: false,
    allowFormFilling: false,
    allowSigning: false,
  });
  assertEquals(((perms >>> 0) & 16) !== 0, true);
});
