import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "../../env.ts";

const drizzleDir = fileURLToPath(new URL("../../db/drizzle", import.meta.url));
const sql = postgres(env.DATABASE_URL, { max: 1 });

try {
  const journal = JSON.parse(
    readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"),
  );
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedSet = new Set(applied.map((r) => String(r.hash)));

  console.log("journal entries:", journal.entries.length);
  console.log("applied hashes:", applied.length);

  const pending: Array<{ tag: string; idx: number; hash: string }> = [];
  for (const entry of journal.entries) {
    const file = join(drizzleDir, `${entry.tag}.sql`);
    const content = readFileSync(file);
    const hash = createHash("sha256").update(content).digest("hex");
    if (!appliedSet.has(hash)) {
      pending.push({ tag: entry.tag, idx: entry.idx, hash: hash.slice(0, 12) });
    }
  }
  console.log("pending count:", pending.length);
  console.log("pending:", pending);
} finally {
  await sql.end({ timeout: 5 });
}
