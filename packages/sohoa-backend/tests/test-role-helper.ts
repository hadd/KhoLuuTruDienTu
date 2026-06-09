import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { roles } from "../db/schemas/index.ts";
import { ROLE_DEFINITIONS } from "../scripts/seed/data.ts";

const ROLE_RULES_BY_ID = Object.fromEntries(
    ROLE_DEFINITIONS.map((role) => [role.id, role.rules]),
);

export async function ensureSeededRole(roleId: string, name: string) {
    const rules = ROLE_RULES_BY_ID[roleId]
        ?? JSON.stringify({ permissions: ["*"], restrictions: [] });
    const seedRole = ROLE_DEFINITIONS.find((r) => r.id === roleId);

    const existing = await db.query.roles.findFirst({
        where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
    });

    if (existing) {
        await db.update(roles)
            .set({
                name,
                rules,
                isBaseRole: seedRole?.isBaseRole ?? false,
                updatedAt: new Date(),
            })
            .where(eq(roles.id, roleId));
        return existing;
    }

    const [created] = await db.insert(roles).values({
        id: roleId,
        name,
        description: `Test role ${roleId}`,
        rules,
        isBaseRole: seedRole?.isBaseRole ?? false,
    }).returning();
    return created;
}
