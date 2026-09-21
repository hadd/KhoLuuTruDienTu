/**
 * Issue a signed page-quota .lic file (run on company machines only).
 *
 *   deno task page-license:issue -- --pages=3000000 --customer="Ben B" --key=./secrets/page-quota-ed25519.pem --out=benb-3tr.lic
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    licenseFileToJson,
    randomMacSaltB64,
    signLicensePayload,
    type PageLicensePayload,
} from "../modules/page-quota/page-quota-crypto.ts";

function argValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const found = Deno.args.find((arg) => arg.startsWith(prefix));
    if (found) return found.slice(prefix.length);
    const idx = Deno.args.indexOf(`--${name}`);
    if (idx >= 0 && Deno.args[idx + 1]) return Deno.args[idx + 1];
    return undefined;
}

function requireArg(name: string): string {
    const value = argValue(name);
    if (!value?.trim()) {
        console.error(`Missing --${name}`);
        Deno.exit(1);
    }
    return value.trim();
}

const pages = Number(requireArg("pages"));
if (!Number.isInteger(pages) || pages < 1) {
    console.error("--pages must be a positive integer (new TOTAL cap, not an increment)");
    Deno.exit(1);
}

const customer = requireArg("customer");
const keyPath = resolve(requireArg("key"));
const outPath = resolve(argValue("out") ?? `${customer.replace(/\s+/g, "-")}-${pages}.lic`);

const privatePem = readFileSync(keyPath, "utf8");
const payload: PageLicensePayload = {
    v: 1,
    customer,
    pageLimit: pages,
    issuedAt: new Date().toISOString(),
    licenseId: crypto.randomUUID(),
    macSalt: randomMacSaltB64(),
};

const file = await signLicensePayload(payload, privatePem);
writeFileSync(outPath, licenseFileToJson(file), { encoding: "utf8" });
console.log(`Wrote ${outPath}`);
console.log(`customer=${customer} pageLimit=${pages} issuedAt=${payload.issuedAt}`);
