import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatContentDisposition } from "./content-disposition.utils.ts";

Deno.test("formatContentDisposition handles Vietnamese unicode characters correctly", () => {
  const result = formatContentDisposition(
    "inline",
    "Thông tư 24_2026_TT_BCT_05_5_2026.pdf",
  );

  // Assert header format
  assertEquals(
    result.includes('inline; filename="Thong tu 24_2026_TT_BCT_05_5_2026.pdf";'),
    true,
  );
  assertEquals(
    result.includes("filename*=UTF-8''"),
    true,
  );

  // Assert Header value is valid ByteString (all code points <= 255)
  for (let i = 0; i < result.length; i++) {
    const charCode = result.charCodeAt(i);
    assertEquals(charCode <= 255, true, `Character '${result[i]}' at index ${i} is not a valid ByteString`);
  }

  // Test creating Web API Response object with this header (should not throw ByteString error)
  const response = new Response("test", {
    headers: {
      "Content-Disposition": result,
    },
  });
  assertEquals(response.headers.get("Content-Disposition"), result);
});
