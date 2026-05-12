import { assertThrows } from "@std/assert";
import { validateId } from "../../src/utils/validate-id.ts";

Deno.test({
    name: "validateId",
    fn: async (t) => {
        await t.step("accepts non-empty string", () => {
            validateId("abc");
            validateId("uuid-like");
        });

        await t.step("accepts positive number", () => {
            validateId(1);
            validateId(100);
        });

        await t.step("throws for empty string", () => {
            assertThrows(() => validateId(""), Error, "Invalid ID");
            assertThrows(() => validateId("   "), Error, "Invalid ID");
        });

        await t.step("throws for invalid number", () => {
            assertThrows(() => validateId(0), Error, "Invalid ID");
            assertThrows(() => validateId(-1), Error, "Invalid ID");
            assertThrows(() => validateId(NaN), Error, "Invalid ID");
        });
    },
});
