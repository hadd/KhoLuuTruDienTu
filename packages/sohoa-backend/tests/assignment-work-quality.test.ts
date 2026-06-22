import { assertEquals } from "@std/assert";
import { fieldChangeAffectsMaker } from "../libs/assignment-work-quality.ts";

Deno.test("fieldChangeAffectsMaker — single maker: any change counts as wrong", () => {
    assertEquals(
        fieldChangeAffectsMaker(["GROUP.A"], null, true),
        true,
    );
    assertEquals(
        fieldChangeAffectsMaker([], null, true),
        false,
    );
});

Deno.test("fieldChangeAffectsMaker — multiple makers: only overlapping fields", () => {
    const slotA = ["NHAN_UY.SO_HO_SO"];

    assertEquals(
        fieldChangeAffectsMaker(["NHAN_UY.SO_HO_SO"], slotA, false),
        true,
    );
    assertEquals(
        fieldChangeAffectsMaker(["OTHER.FIELD"], slotA, false),
        false,
    );
    assertEquals(
        fieldChangeAffectsMaker(["NHAN_UY.*"], slotA, false),
        true,
    );
});

Deno.test("fieldChangeAffectsMaker — OCR field name matches ACL slot", () => {
    const slotA = ["NHAN_UY.HO_VA_TEN"];

    assertEquals(
        fieldChangeAffectsMaker(["NHAN_UY._1_HO_VA_TEN"], slotA, false),
        true,
    );
    assertEquals(
        fieldChangeAffectsMaker(["NHAN_UY.SO_KHAC"], slotA, false),
        false,
    );
});

Deno.test("fieldChangeAffectsMaker — full-access maker matches any changed field", () => {
    assertEquals(
        fieldChangeAffectsMaker(["ANY.FIELD"], null, false),
        true,
    );
});
