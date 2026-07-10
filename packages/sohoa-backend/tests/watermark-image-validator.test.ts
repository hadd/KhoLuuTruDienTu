import { assertEquals, assertThrows } from "@std/assert";
import { sanitizeSvgMarkup, validateWatermarkImageBytes } from "../libs/watermark/watermark-image-validator.ts";

Deno.test("sanitizeSvgMarkup strips script and event handlers", () => {
    const dirty = `
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
  <script>alert(1)</script>
  <circle cx="10" cy="10" r="5" onclick="evil()" />
  <a href="javascript:alert(1)">x</a>
</svg>`;
    const clean = sanitizeSvgMarkup(dirty);
    assertEquals(/<script/i.test(clean), false);
    assertEquals(/onload=/i.test(clean), false);
    assertEquals(/onclick=/i.test(clean), false);
    assertEquals(/javascript:/i.test(clean), false);
});

Deno.test("validateWatermarkImageBytes accepts PNG magic", () => {
    const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
    ]);
    const result = validateWatermarkImageBytes(png, "logo.png");
    assertEquals(result.kind, "png");
    assertEquals(result.mimeType, "image/png");
});

Deno.test("validateWatermarkImageBytes rejects jpg", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assertThrows(() => validateWatermarkImageBytes(jpeg, "logo.jpg"));
});

Deno.test("validateWatermarkImageBytes accepts sanitized svg", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    const result = validateWatermarkImageBytes(svg, "mark.svg");
    assertEquals(result.kind, "svg");
    assertEquals(result.mimeType, "image/svg+xml");
});
