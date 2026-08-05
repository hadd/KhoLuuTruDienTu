import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { auditLogPurgeState } from "../../db/schemas/audit-log-purge-state.ts";
import { auditLogSettings } from "../../db/schemas/audit-log-settings.ts";

const LEASE_TTL_MS = 30 * 60 * 1000;

async function ensurePurgeStateRow() {
    const existing = await db.query.auditLogPurgeState.findFirst();
    if (existing) return existing;

    const settings = await db.query.auditLogSettings.findFirst();
    const [created] = await db.insert(auditLogPurgeState).values({
        cursorUntil: settings?.purgeCursorUntil ?? null,
        lastRunAt: settings?.lastPurgeAt ?? null,
        lastSuccessAt: settings?.lastPurgeAt ?? null,
    }).returning();
    return created;
}

export async function acquirePurgeLease(owner: string): Promise<{
    acquired: boolean;
    state: typeof auditLogPurgeState.$inferSelect;
}> {
    const state = await ensurePurgeStateRow();
    const now = new Date();
    const leaseActive = state.leaseUntil && state.leaseUntil > now && state.leaseOwner !== owner;
    if (leaseActive) {
        return { acquired: false, state };
    }

    const leaseUntil = new Date(now.getTime() + LEASE_TTL_MS);
    const [updated] = await db.update(auditLogPurgeState).set({
        leaseOwner: owner,
        leaseUntil,
        lastRunAt: now,
        updatedAt: now,
    }).where(eq(auditLogPurgeState.id, state.id)).returning();

    return { acquired: true, state: updated };
}

export async function releasePurgeLease(owner: string, patch?: {
    cursorUntil?: Date | null;
    lastError?: string | null;
    success?: boolean;
}): Promise<void> {
    const state = await ensurePurgeStateRow();
    if (state.leaseOwner !== owner) return;

    const now = new Date();
    await db.update(auditLogPurgeState).set({
        leaseOwner: null,
        leaseUntil: null,
        cursorUntil: patch?.cursorUntil !== undefined ? patch.cursorUntil : state.cursorUntil,
        lastError: patch?.lastError !== undefined ? patch.lastError : null,
        lastSuccessAt: patch?.success ? now : state.lastSuccessAt,
        updatedAt: now,
    }).where(eq(auditLogPurgeState.id, state.id));
}

export async function setPurgeCursorUntil(cursorUntil: Date): Promise<void> {
    const state = await ensurePurgeStateRow();
    await db.update(auditLogPurgeState).set({
        cursorUntil,
        updatedAt: new Date(),
    }).where(eq(auditLogPurgeState.id, state.id));
}

export async function getPurgeState() {
    return await ensurePurgeStateRow();
}

export async function markSettingsLastPurge(): Promise<void> {
    const settings = await db.query.auditLogSettings.findFirst();
    if (!settings) return;
    await db.update(auditLogSettings).set({
        lastPurgeAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(auditLogSettings.id, settings.id));
}

export { LEASE_TTL_MS };
