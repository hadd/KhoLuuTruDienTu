/**
 * Test Database Seeding Script
 * 
 * Sets up the test database schema and seeds it with test data.
 * Run this script before running tests to ensure the database is properly seeded.
 * 
 * Usage: deno task seed
 */

import { setupTestDatabase, getTestDb, closeTestDb, dropTestSchema } from "./setup/utils.ts";
import { setupSeedData, SEED_UUIDS } from "./fixtures/seed.ts";

function validateSeededIds(seedData: Awaited<ReturnType<typeof setupSeedData>>): void {
    const expectedAuthorIds: string[] = Object.values(SEED_UUIDS.authors) as string[];
    const expectedPublisherIds: string[] = Object.values(SEED_UUIDS.publishers) as string[];
    const expectedBookIds: string[] = Object.values(SEED_UUIDS.books) as string[];
    
    const seededAuthorIds = seedData.authors.map(a => a.id);
    const seededPublisherIds = seedData.publishers.map(p => p.id);
    const seededBookIds = seedData.books.map(b => b.id);
    
    const missingAuthorIds = expectedAuthorIds.filter(id => !seededAuthorIds.includes(id));
    const missingPublisherIds = expectedPublisherIds.filter(id => !seededPublisherIds.includes(id));
    const missingBookIds = expectedBookIds.filter(id => !seededBookIds.includes(id));
    
    if (missingAuthorIds.length > 0 || missingPublisherIds.length > 0 || missingBookIds.length > 0) {
        const errors: string[] = [];
        if (missingAuthorIds.length > 0) {
            errors.push(`Missing author IDs: ${missingAuthorIds.join(", ")}`);
        }
        if (missingPublisherIds.length > 0) {
            errors.push(`Missing publisher IDs: ${missingPublisherIds.join(", ")}`);
        }
        if (missingBookIds.length > 0) {
            errors.push(`Missing book IDs: ${missingBookIds.join(", ")}`);
        }
        throw new Error(`ID validation failed:\n${errors.join("\n")}`);
    }
}

async function seedTestDatabase(reset: boolean = false): Promise<void> {
    console.log("🌱 Seeding test database...");
    
    try {
        // Drop schema if reset is requested
        if (reset) {
            console.log("🔄 Resetting test database (dropping schema)...");
            await dropTestSchema();
        }
        
        // Set up the database schema
        console.log("📋 Setting up test database schema...");
        await setupTestDatabase(true);
        
        // Get database connection
        const db = getTestDb();
        
        // Seed test data
        console.log("📦 Seeding test data...");
        const seedData = await setupSeedData(db);
        
        // Validate seeded IDs
        console.log("🔍 Validating seeded record IDs...");
        validateSeededIds(seedData);
        
        const expectedAuthorIds: string[] = Object.values(SEED_UUIDS.authors) as string[];
        const expectedPublisherIds: string[] = Object.values(SEED_UUIDS.publishers) as string[];
        const expectedBookIds: string[] = Object.values(SEED_UUIDS.books) as string[];
        
        console.log(`✅ Test database seeded successfully!`);
        console.log(`   - Authors: ${seedData.authors.length} (${seedData.authors.filter(a => expectedAuthorIds.includes(a.id)).length} with expected IDs)`);
        console.log(`   - Publishers: ${seedData.publishers.length} (${seedData.publishers.filter(p => expectedPublisherIds.includes(p.id)).length} with expected IDs)`);
        console.log(`   - Books: ${seedData.books.length} (${seedData.books.filter(b => expectedBookIds.includes(b.id)).length} with expected IDs)`);
        console.log(`   - Book Details: ${seedData.bookDetails.length}`);
        
        // Log some example IDs for reference
        if (seedData.authors.length > 0) {
            console.log(`   📝 Example author ID: ${seedData.authors[0].id}`);
        }
        if (seedData.books.length > 0) {
            console.log(`   📝 Example book ID: ${seedData.books[0].id}`);
        }
    } catch (error) {
        console.error("❌ Failed to seed test database:", error);
        throw error;
    } finally {
        await closeTestDb();
    }
}

// Run the seeding script
if (import.meta.main) {
    const reset = Deno.args.includes("--reset");
    await seedTestDatabase(reset);
}

