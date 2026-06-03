import { assertEquals } from "@std/assert";
import {
    activeDossierWhere,
    activeFolderWhere,
    isActiveDossier,
    isActiveFolder,
} from "../modules/dossier/active-query-filters.ts";

Deno.test("isActiveDossier and isActiveFolder", () => {
    assertEquals(isActiveDossier({ deletedAt: null }), true);
    assertEquals(isActiveDossier({ deletedAt: new Date() }), false);
    assertEquals(isActiveDossier(null), false);

    assertEquals(isActiveFolder({ deletedAt: null }), true);
    assertEquals(isActiveFolder({ deletedAt: new Date() }), false);
});

Deno.test("activeDossierWhere and activeFolderWhere are defined", () => {
    assertEquals(activeDossierWhere() !== undefined, true);
    assertEquals(activeFolderWhere() !== undefined, true);
});
