/**
 * Seed/fix encrypt_download_dossier permission + backfill level rules.
 * Also refreshes encrypt_download display name.
 *
 * Run: deno run -A --env scripts/fix-encrypt-download-dossier-permission.ts
 */
import { and, eq, isNull } from "drizzle-orm";
import { connectDb, closeDb } from "../db/db-conn.ts";
import { securityLevels } from "../db/schemas/security-level.ts";
import { securityPermissionDefs } from "../db/schemas/security-permission-def.ts";
import { securityLevelRules } from "../db/schemas/security-level-rule.ts";
import {
  SYSTEM_DEFAULT_RULE_VALUES,
  permissionRuleKey,
} from "../modules/security-level/security-rule-keys.ts";

const DEFS = [
  {
    key: "encrypt_download",
    name: "Mã hóa ZIP bằng PIN cá nhân",
    description:
      "Khóa file ZIP tải xuống bằng mã PIN cá nhân của người tải",
    isSystem: true,
    isActive: true,
  },
  {
    key: "encrypt_download_dossier",
    name: "Mã hóa ZIP bằng mật khẩu hồ sơ",
    description:
      "Khóa file ZIP tải xuống bằng mật khẩu truy cập hồ sơ/cấp (nhập lúc tải)",
    isSystem: true,
    isActive: true,
  },
] as const;

const db = connectDb();

try {
  for (const def of DEFS) {
    const [existing] = await db
      .select({ id: securityPermissionDefs.id })
      .from(securityPermissionDefs)
      .where(
        and(
          eq(securityPermissionDefs.key, def.key),
          isNull(securityPermissionDefs.deletedAt),
        ),
      )
      .limit(1);

    let defId: string;
    if (existing) {
      await db
        .update(securityPermissionDefs)
        .set({
          name: def.name,
          description: def.description,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(securityPermissionDefs.id, existing.id));
      defId = existing.id;
      console.log(`✅ Updated def: ${def.key}`);
    } else {
      const [inserted] = await db
        .insert(securityPermissionDefs)
        .values(def)
        .returning({ id: securityPermissionDefs.id });
      defId = inserted!.id;
      console.log(`✅ Inserted def: ${def.key} (id=${defId})`);
    }

    const ruleKey = permissionRuleKey(def.key);
    const defaultValue = SYSTEM_DEFAULT_RULE_VALUES[ruleKey] ?? false;

    const levels = await db
      .select({
        id: securityLevels.id,
        name: securityLevels.name,
        levelOrder: securityLevels.levelOrder,
      })
      .from(securityLevels)
      .where(
        and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)),
      );

    for (const level of levels) {
      const [ruleExists] = await db
        .select({ id: securityLevelRules.id })
        .from(securityLevelRules)
        .where(
          and(
            eq(securityLevelRules.securityLevelId, level.id),
            eq(securityLevelRules.ruleKey, ruleKey),
          ),
        )
        .limit(1);

      if (ruleExists) {
        console.log(
          `⏭️  Rule ${ruleKey} exists for level "${level.name}" (${level.levelOrder})`,
        );
        continue;
      }

      const isLowest = levels.every((l) => l.levelOrder >= level.levelOrder);
      await db.insert(securityLevelRules).values({
        securityLevelId: level.id,
        ruleKey,
        isOverridden: isLowest,
        value: defaultValue,
      });
      console.log(
        `✅ Backfilled ${ruleKey} for level "${level.name}" (${level.levelOrder})`,
      );
    }
  }

  console.log("Done.");
} finally {
  await closeDb();
}
