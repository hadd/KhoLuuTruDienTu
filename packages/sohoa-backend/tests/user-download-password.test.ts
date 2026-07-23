import { assertEquals } from "@std/assert";
import { stripProfileSecrets } from "../modules/profile/profile-service.ts";
import { downloadErrorMessage } from "../modules/download/download-log-service.ts";
import {
    decryptPassword,
    encryptPassword,
} from "../libs/email-crypto.ts";
import { createFondSchema, fondEntitySchema } from "../modules/fond/types.ts";

Deno.test("stripProfileSecrets removes login and download secrets", () => {
    const result = stripProfileSecrets({
        id: "u1",
        email: "a@b.c",
        passwordHash: "hash",
        downloadPasswordEncrypted: "cipher",
        downloadPasswordEnabled: true,
        fullName: "A",
    });

    assertEquals(
        Object.prototype.hasOwnProperty.call(result, "passwordHash"),
        false,
    );
    assertEquals(
        Object.prototype.hasOwnProperty.call(result, "downloadPasswordEncrypted"),
        false,
    );
    assertEquals(result?.hasDownloadPassword, true);
    assertEquals(result?.downloadPasswordEnabled, true);
    assertEquals(result?.email, "a@b.c");
});

Deno.test("stripProfileSecrets reports no download password when unset", () => {
    const result = stripProfileSecrets({
        id: "u1",
        email: "a@b.c",
        passwordHash: null,
        downloadPasswordEncrypted: null,
        downloadPasswordEnabled: false,
    });
    assertEquals(result?.hasDownloadPassword, false);
    assertEquals(result?.downloadPasswordEnabled, false);
});

Deno.test("encrypt/decrypt roundtrip for download password", async () => {
    const plain = "MyDownloadPass!1";
    const cipher = await encryptPassword(plain);
    assertEquals(await decryptPassword(cipher), plain);
});

Deno.test("downloadErrorMessage truncates long messages", () => {
    const long = "x".repeat(600);
    const msg = downloadErrorMessage({ message: long });
    assertEquals(msg.length, 500);
});

Deno.test("fond schemas no longer include zip password fields", () => {
    const entityKeys = Object.keys(
        (fondEntitySchema as { properties?: Record<string, unknown> }).properties ??
            {},
    );
    assertEquals(entityKeys.includes("hasZipPassword"), false);
    assertEquals(entityKeys.includes("zipPasswordEnabled"), false);

    const createKeys = Object.keys(
        (createFondSchema as { properties?: Record<string, unknown> }).properties ??
            {},
    );
    assertEquals(createKeys.includes("zipPassword"), false);
    assertEquals(createKeys.includes("zipPasswordEnabled"), false);
});
