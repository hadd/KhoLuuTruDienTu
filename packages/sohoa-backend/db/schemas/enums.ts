import { t } from "elysia";

export const genderElysiaType = t.Union([
    t.Literal("male"),
    t.Literal("female"),
    t.Literal("other"),
    t.Literal("unspecified"),
]);
