import { assertEquals } from "@std/assert";
import { decryptPassword, encryptPassword } from "../libs/email-crypto.ts";
import { formatEmailFrom, getEmailConfigStatus } from "../libs/email-config.ts";

Deno.test("formatEmailFrom returns email only when fromName is empty", () => {
    assertEquals(
        formatEmailFrom({ fromEmail: "noreply@fsi.vn", fromName: null }),
        "noreply@fsi.vn",
    );
    assertEquals(
        formatEmailFrom({ fromEmail: "noreply@fsi.vn", fromName: "  " }),
        "noreply@fsi.vn",
    );
});

Deno.test("formatEmailFrom includes display name when provided", () => {
    assertEquals(
        formatEmailFrom({ fromEmail: "noreply@fsi.vn", fromName: "Hệ thống Sohoa" }),
        '"Hệ thống Sohoa" <noreply@fsi.vn>',
    );
});

Deno.test("formatEmailFrom escapes quotes in display name", () => {
    assertEquals(
        formatEmailFrom({ fromEmail: "noreply@fsi.vn", fromName: 'A "Test" Name' }),
        '"A \\"Test\\" Name" <noreply@fsi.vn>',
    );
});

Deno.test("encryptPassword and decryptPassword roundtrip", async () => {
    const plain = "smtp-secret-123";
    const encrypted = await encryptPassword(plain);
    const decrypted = await decryptPassword(encrypted);
    assertEquals(decrypted, plain);
    assertEquals(encrypted.includes(plain), false);
});

Deno.test("getEmailConfigStatus reports missing infra and sender fields", async () => {
    const status = await getEmailConfigStatus();
    assertEquals(typeof status.configured, "boolean");
    assertEquals(typeof status.infraReady, "boolean");
    assertEquals(typeof status.senderReady, "boolean");
    assertEquals(Array.isArray(status.missingFields), true);

    if (!status.infraReady) {
        assertEquals(status.missingFields.includes("SMTP_HOST"), true);
    }
    if (!status.senderReady) {
        assertEquals(
            status.missingFields.some((field) => field === "fromEmail" || field === "smtpPassword"),
            true,
        );
    }
});

Deno.test("getEmailConfigStatus configured implies infra and sender ready", async () => {
    const status = await getEmailConfigStatus();
    if (status.configured) {
        assertEquals(status.infraReady, true);
        assertEquals(status.senderReady, true);
        assertEquals(status.missingFields.length, 0);
    }
});
