/**
 * Generate Ed25519 key pair for page-quota licenses.
 * Keep the .pem private key OFF customer tar packs.
 *
 *   deno task page-license:gen-keys -- --out-dir=./secrets
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePageQuotaKeyPair } from "../modules/page-quota/page-quota-crypto.ts";

function argValue(name: string, fallback: string): string {
    const prefix = `--${name}=`;
    const found = Deno.args.find((arg) => arg.startsWith(prefix));
    if (found) return found.slice(prefix.length);
    const idx = Deno.args.indexOf(`--${name}`);
    if (idx >= 0 && Deno.args[idx + 1]) return Deno.args[idx + 1]!;
    return fallback;
}

const outDir = resolve(argValue("out-dir", "./secrets"));
mkdirSync(outDir, { recursive: true });

const pair = await generatePageQuotaKeyPair();
const pemPath = resolve(outDir, "page-quota-ed25519.pem");
const pubPath = resolve(outDir, "page-quota-ed25519.pub");
writeFileSync(pemPath, pair.privatePem, { encoding: "utf8" });
writeFileSync(pubPath, `${pair.publicKeyB64}\n`, { encoding: "utf8" });

console.log("");
console.log("=== Key pair created ===");
console.log(`Private key (GIỮ BÍ MẬT, không đưa khách): ${pemPath}`);
console.log(`Public key file:                          ${pubPath}`);
console.log("");
console.log("Bước tiếp theo:");
console.log("1) Mở file .pub hoặc copy chuỗi dưới đây");
console.log("2) Dán vào modules/page-quota/page-quota-public-key.ts");
console.log("   thay REPLACE_WITH_GEN_KEYS_OUTPUT");
console.log("");
console.log(pair.publicKeyB64);
console.log("");
console.log("3) deno task db:migrate");
console.log("4) Phát .lic: deno task page-license:issue -- --pages=3000000 --customer=\"...\" --key=./secrets/page-quota-ed25519.pem --out=khach-3tr.lic");
console.log("");
console.log("Chi tiết: scripts/PAGE_LICENSE.md");
