/**
 * Bật permission.view + seed thiếu security_permission_defs nếu cần.
 * Run: deno run -A --env scripts/fix-permission-view.ts
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { connectDb, closeDb } from "../db/db-conn.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { securityLevels } from "../db/schemas/security-level.ts";
import { securityLevelRules } from "../db/schemas/security-level-rule.ts";
import { securityPermissionDefs } from "../db/schemas/security-permission-def.ts";
import { getEffectiveBool } from "../modules/security-level/security-clearance.ts";
import {
  PermissionRuleKey,
  SYSTEM_PERMISSION_DEFS,
} from "../modules/security-level/security-rule-keys.ts";

const DOSSIER_ID = "f9a8990d-3f8b-4419-9d08-67c4560c3ae5";
const RULE_KEY = PermissionRuleKey.view;

const db = connectDb();

try {
  const existingDefs = await db
    .select({ key: securityPermissionDefs.key })
    .from(securityPermissionDefs)
    .where(isNull(securityPermissionDefs.deletedAt));
  const existingKeys = new Set(existingDefs.map((d) => d.key));
  console.log("Existing permission defs:", [...existingKeys]);

  const missingDefs = SYSTEM_PERMISSION_DEFS.filter((d) => !existingKeys.has(d.key));
  if (missingDefs.length > 0) {
    await db.insert(securityPermissionDefs).values(
      missingDefs.map((d) => ({
        key: d.key,
        name: d.name,
        description: d.description,
        isSystem: true,
        isActive: true,
      })),
    );
    console.log("Inserted missing permission defs:", missingDefs.map((d) => d.key));
  }

  const [dossier] = await db
    .select({
      id: dossiers.id,
      name: dossiers.name,
      securityLevelId: dossiers.securityLevelId,
    })
    .from(dossiers)
    .where(eq(dossiers.id, DOSSIER_ID))
    .limit(1);

  console.log("Dossier:", dossier ?? "(not found)");

  const levels = await db
    .select({
      id: securityLevels.id,
      name: securityLevels.name,
      levelOrder: securityLevels.levelOrder,
    })
    .from(securityLevels)
    .where(and(eq(securityLevels.isActive, true), isNull(securityLevels.deletedAt)))
    .orderBy(asc(securityLevels.levelOrder));

  const targetLevelId = dossier?.securityLevelId ?? levels[0]?.id;
  if (!targetLevelId) {
    throw new Error("Không tìm thấy security level để sửa.");
  }

  const levelIdsToFix = new Set<string>([targetLevelId]);
  // Seed permission.view = true trên mọi cấp active để kế thừa không bị thiếu
  for (const level of levels) {
    levelIdsToFix.add(level.id);
  }

  for (const levelId of levelIdsToFix) {
    const [existing] = await db
      .select({ id: securityLevelRules.id, value: securityLevelRules.value })
      .from(securityLevelRules)
      .where(and(
        eq(securityLevelRules.securityLevelId, levelId),
        eq(securityLevelRules.ruleKey, RULE_KEY),
      ))
      .limit(1);

    if (existing) {
      await db
        .update(securityLevelRules)
        .set({
          value: true,
          isOverridden: true,
          updatedAt: new Date(),
        })
        .where(eq(securityLevelRules.id, existing.id));
      console.log("Updated permission.view for level", levelId);
    } else {
      await db.insert(securityLevelRules).values({
        securityLevelId: levelId,
        ruleKey: RULE_KEY,
        isOverridden: true,
        value: true,
      });
      console.log("Inserted permission.view for level", levelId);
    }
  }

  const allowed = await getEffectiveBool(targetLevelId, RULE_KEY);
  console.log("Effective permission.view for dossier level:", allowed);
  console.log("Done.");
} finally {
  await closeDb();
}
