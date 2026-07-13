/**
 * Soft-deletes leftover test roles whose ids contain "/" (breaks /:id path routes).
 * Run: deno run -A --env scripts/cleanup-slash-role-ids.ts
 */
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { roles } from "../db/schemas/index.ts";

const activeRoles = await db.query.roles.findMany({
    where: isNull(roles.deletedAt),
    columns: { id: true, name: true },
});

const badRoles = activeRoles.filter((role) => role.id.includes("/"));
console.log("Found roles with '/' in id:", badRoles);

if (badRoles.length === 0) {
    console.log("Nothing to clean up.");
    await db.$client.end();
    Deno.exit(0);
}

const result = await db.update(roles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
        isNull(roles.deletedAt),
        inArray(roles.id, badRoles.map((role) => role.id)),
    ))
    .returning({ id: roles.id });

console.log("Soft-deleted:", result);
await db.$client.end();
