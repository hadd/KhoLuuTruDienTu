import { db } from "../db/db-conn.ts";
import { userProfiles } from "../db/schemas/user_profile.ts";
import { isNotNull } from "drizzle-orm";
import { ProfileService } from "../modules/profile/profile-service.ts";

const BASE_URL = Deno.env.get("API_BASE_URL") ?? "http://localhost:8000";
const ACCESS_TOKEN = Deno.env.get("ACCESS_TOKEN");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "admin@sohoa.vn";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "Admin@sohoa2026";

const softDeletedUsers = await db
    .select({ id: userProfiles.id, email: userProfiles.email, deletedAt: userProfiles.deletedAt })
    .from(userProfiles)
    .where(isNotNull(userProfiles.deletedAt));

if (softDeletedUsers.length === 0) {
    console.log("No soft-deleted users found.");
    Deno.exit(0);
}

console.log(`Found ${softDeletedUsers.length} soft-deleted user(s).`);
const ids = softDeletedUsers.map((u) => u.id);

async function deleteViaApi(token: string) {
    const deleteRes = await fetch(`${BASE_URL}/api/v1/admin/users/permanent-delete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
    });
    const result = await deleteRes.json();
    if (!deleteRes.ok) {
        throw new Error(`API ${deleteRes.status}: ${JSON.stringify(result)}`);
    }
    return result;
}

async function getAccessToken(): Promise<string | null> {
    if (ACCESS_TOKEN) return ACCESS_TOKEN;

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!loginRes.ok) return null;
    const { accessToken } = await loginRes.json() as { accessToken: string };
    return accessToken;
}

const token = await getAccessToken();
if (token) {
    console.log("Calling POST /api/v1/admin/users/permanent-delete ...");
    const result = await deleteViaApi(token);
    console.log("Permanent delete result:", JSON.stringify(result, null, 2));
} else {
    console.log("Login failed — calling ProfileService.permanentDeleteUsers directly.");
    const result = await ProfileService.permanentDeleteUsers({ ids });
    console.log("Permanent delete result:", JSON.stringify({ ...result, status: "permanently_deleted" }, null, 2));
}
