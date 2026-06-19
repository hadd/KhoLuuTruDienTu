/**
 * Seed Data Constants
 *
 * Centralized data definitions for seeding
 */

/**
 * Seed version - increment this when seed data changes
 * This is used by the test setup to determine if re-seeding is needed
 */
export const SEED_VERSION = "v0.0.6";

// User data with credentials
export const USERS = [
    {
        email: "admin@sohoa.vn",
        password: "Admin@sohoa2026",
        fullName: "System Administrator",
        role: "admin",
    },
];

// Role definitions
export const ROLE_DEFINITIONS = [
    {
        id: "admin",
        name: "Administrator",
        description: "System administrator with full access",
        rules: JSON.stringify({
            permissions: ["*"],
            restrictions: [],
        }),
        isBaseRole: true,
    },
    {
        id: "editor",
        name: "Editor",
        description: "Data entry maker with folder and dossier access",
        rules: JSON.stringify({
            permissions: [
                "folders.read",
                "dossiers.read",
                "projects.read",
                "data-entry.maker",
                "groups.read",
            ],
            restrictions: [],
        }),
        isBaseRole: true,
    },
    {
        id: "qc",
        name: "QC",
        description: "Quality checker with data-entry checker access",
        rules: JSON.stringify({
            permissions: [
                "data-entry.checker",
                "folders.read",
                "dossiers.read",
                "dossiers.assign",
                "dossiers.export",
                "groups.read",
            ],
            restrictions: [],
        }),
        isBaseRole: true,
    },
];
