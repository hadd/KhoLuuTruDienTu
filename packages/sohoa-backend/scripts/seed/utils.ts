/**
 * Utility Functions for Seeding
 */

/**
 * Simple password hashing function
 * In production, use a proper hashing library like bcrypt
 */
export function hashPassword(password: string): string {
    // This is a simple hash for demo purposes
    // In production, use: await bcrypt.hash(password, 10)
    return btoa(password + "_hashed");
}

/**
 * Generate a simple provider ID for native authentication
 */
export function generateProviderId(email: string): string {
    return `native_${email.replace('@', '_at_')}`;
}

/**
 * Generate a UUID v4 (for testing purposes)
 * In production, the database will generate UUIDs automatically
 */
export function generateUUID(): string {
    return crypto.randomUUID();
}

/**
 * Logger utility for seeding scripts
 */
export const logger = {
    info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};
