/**
 * Seed Data Constants
 * 
 * Centralized data definitions for seeding
 */

/**
 * Seed version - increment this when seed data changes
 * This is used by the test setup to determine if re-seeding is needed
 */
export const SEED_VERSION = "v0.0.1";

// User data with credentials
export const USERS = [
    {
        email: "admin@sohoa.vn",
        password: "Admin@sohoa2026",
        fullName: "System Administrator",
        role: "admin"
    },
];

// Role definitions
export const ROLE_DEFINITIONS = [
    {
        id: "admin",
        name: "Administrator",
        description: "System administrator with full access",
        rules: JSON.stringify({
            permissions: ["*"], // Các quyền được thực hiện
            restrictions: [] // Các quyền không được thực hiện
        }),
        isBaseRole: true
    },
];
