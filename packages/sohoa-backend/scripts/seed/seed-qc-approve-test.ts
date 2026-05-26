/**
 * Seed dossiers + assignments ready for POST /api/v1/data-entry/checker{N}/approve
 *
 * Usage: deno task seed:qc-approve-test
 */

import { and, eq, isNull } from "drizzle-orm";
import { connectDb, closeDb } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { folders } from "../../db/schemas/folder.ts";
import { roles, userProfiles, userRoles } from "../../db/schemas/index.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
} from "../../db/schemas/workflow-constants.ts";
import { hashPassword } from "../../libs/helpers/password.ts";
import { logger } from "./utils.ts";

const TEST_PASSWORD = "Test@sohoa2026";
const TEST_PREFIX = "seed/qc-approve-test";

const WORKER_ROLE_DEFINITIONS = [
    { id: WorkerRole.MAKER, name: "Data entry maker" },
    { id: WorkerRole.CHECKER_1, name: "QC checker step 1" },
    { id: WorkerRole.CHECKER_2, name: "QC checker step 2" },
    { id: WorkerRole.CHECKER_3, name: "QC checker step 3" },
    { id: WorkerRole.CHECKER_4, name: "QC checker step 4" },
    { id: WorkerRole.CHECKER_5, name: "QC checker step 5" },
] as const;

const TEST_USERS = [
    { email: "checker1@sohoa.vn", fullName: "QC Checker 1", roles: [WorkerRole.CHECKER_1] },
    { email: "checker2@sohoa.vn", fullName: "QC Checker 2", roles: [WorkerRole.CHECKER_2] },
    { email: "checker3@sohoa.vn", fullName: "QC Checker 3", roles: [WorkerRole.CHECKER_3] },
    { email: "qc-all@sohoa.vn", fullName: "QC All Steps", roles: QC_CHECKER_WORKFLOW.map((c) => c.role) },
] as const;

type SeedResult = {
    checkerStep: number;
    assignmentId: string;
    dossierId: string;
    assigneeEmail: string;
    dossierStatus: string;
    currentQcStep: number;
    requiredQcCount: number;
};

async function ensureRole(db: ReturnType<typeof connectDb>, roleId: string, name: string) {
    const existing = await db.query.roles.findFirst({
        where: and(eq(roles.id, roleId), isNull(roles.deletedAt)),
    });
    if (existing) {
        return existing;
    }
    const [created] = await db.insert(roles).values({
        id: roleId,
        name,
        description: `Test role ${roleId}`,
        rules: JSON.stringify({ permissions: ["*"], restrictions: [] }),
        isBaseRole: false,
    }).returning();
    return created;
}

async function ensureUser(
    db: ReturnType<typeof connectDb>,
    input: { email: string; fullName: string; roleIds: string[] },
) {
    let profile = await db.query.userProfiles.findFirst({
        where: and(eq(userProfiles.email, input.email), isNull(userProfiles.deletedAt)),
    });

    if (!profile) {
        const passwordHash = await hashPassword(TEST_PASSWORD);
        [profile] = await db.insert(userProfiles).values({
            email: input.email,
            fullName: input.fullName,
            passwordHash,
        }).returning();
        logger.info(`Created user ${input.email}`);
    }

    for (const roleId of input.roleIds) {
        const hasRole = await db.query.userRoles.findFirst({
            where: and(
                eq(userRoles.userId, profile.id),
                eq(userRoles.roleId, roleId),
                isNull(userRoles.expiredAt),
            ),
        });
        if (!hasRole) {
            await db.insert(userRoles).values({ userId: profile.id, roleId });
        }
    }

    return profile;
}

export async function seedQcApproveTest() {
    const db = connectDb();
    const results: SeedResult[] = [];

    logger.info("Seeding worker roles...");
    for (const role of WORKER_ROLE_DEFINITIONS) {
        await ensureRole(db, role.id, role.name);
    }

    logger.info("Seeding checker users...");
    const usersByRole = new Map<string, { id: string; email: string }>();
    for (const user of TEST_USERS) {
        const profile = await ensureUser(db, {
            email: user.email,
            fullName: user.fullName,
            roleIds: [...user.roles],
        });
        for (const role of user.roles) {
            usersByRole.set(role, { id: profile.id, email: user.email });
        }
    }

    const folderPath = `${TEST_PREFIX}/folder`;
    let folder = await db.query.folders.findFirst({
        where: eq(folders.folderPath, folderPath),
    });
    if (!folder) {
        [folder] = await db.insert(folders).values({
            folderPath,
            folderName: "qc-approve-test",
        }).returning();
    }

    const metadataBase = `${folderPath}/ho-so/metadata/ocr-result`;
    const ocrMetadataKey = `${metadataBase}.json`;
    const currentMetadataKey = `${metadataBase}_maker.json`;

    for (const config of QC_CHECKER_WORKFLOW) {
        const dossierName = `ho-so-checker-${config.step}`;
        const assignee = usersByRole.get(config.role);
        if (!assignee) {
            throw new Error(`No test user for role ${config.role}`);
        }

        const existingDossier = await db.query.dossiers.findFirst({
            where: and(
                eq(dossiers.folderPath, folderPath),
                eq(dossiers.name, dossierName),
            ),
        });

        let dossier = existingDossier;
        if (!dossier) {
            [dossier] = await db.insert(dossiers).values({
                folderId: folder.id,
                folderPath,
                name: dossierName,
                entityType: EntityType.DOCUMENT,
                status: config.processing,
                requiredQcCount: 3,
                currentQcStep: config.step - 1,
                ocrMetadataKey,
                currentMetadataKey,
            }).returning();

            await db.insert(dossierFiles).values({
                dossierId: dossier.id,
                fileName: "scan.pdf",
                filePath: `${folderPath}/${dossierName}/scan.pdf`,
                fileSizeKb: 100,
            });
        } else {
            [dossier] = await db.update(dossiers).set({
                status: config.processing,
                requiredQcCount: 3,
                currentQcStep: config.step - 1,
                ocrMetadataKey,
                currentMetadataKey,
                updatedAt: new Date(),
            }).where(eq(dossiers.id, dossier.id)).returning();
        }

        const existingAssignment = await db.query.dossierAssignments.findFirst({
            where: and(
                eq(dossierAssignments.dossierId, dossier.id),
                eq(dossierAssignments.role, config.role),
                eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
            ),
        });

        let assignment = existingAssignment;
        if (!assignment) {
            [assignment] = await db.insert(dossierAssignments).values({
                dossierId: dossier.id,
                role: config.role,
                assigneeId: assignee.id,
                attemptNumber: 1,
                stepNumber: config.step,
                status: AssignmentStatus.IN_PROGRESS,
            }).returning();
        }

        results.push({
            checkerStep: config.step,
            assignmentId: assignment.id,
            dossierId: dossier.id,
            assigneeEmail: assignee.email,
            dossierStatus: dossier.status,
            currentQcStep: dossier.currentQcStep,
            requiredQcCount: dossier.requiredQcCount,
        });
    }

    return { results, password: TEST_PASSWORD };
}

function printInstructions(
    data: Awaited<ReturnType<typeof seedQcApproveTest>>,
) {
    const baseUrl = Deno.env.get("API_BASE_URL") ?? "http://localhost:8000";

    console.log("\n========== QC APPROVE TEST DATA ==========\n");
    console.log("Password (all checker users):", data.password);
    console.log("\n--- Dossiers ready to approve ---\n");
    console.table(data.results);

    console.log("\n--- Sample metadata body ---\n");
    const sampleMetadata = {
        title: "Hồ sơ test duyệt QC",
        pages: [{ page: 1, fields: { so_ho_so: "HS-TEST-001" } }],
    };
    console.log(JSON.stringify(sampleMetadata, null, 2));

    console.log("\n--- cURL examples (Checker 1) ---\n");
    const checker1 = data.results.find((r) => r.checkerStep === 1)!;
    console.log(`# 1) Login
curl -s -X POST ${baseUrl}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${checker1.assigneeEmail}","password":"${data.password}"}'

# 2) Approve (paste accessToken from step 1) — auto-detect checker step from currentQcStep
curl -s -X POST ${baseUrl}/api/v1/data-entry/checker/approve/${checker1.dossierId} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <accessToken>" \\
  -d '{}'
`);

    console.log("\nExpected after CHECKER_1 approve (requiredQcCount=3):");
    console.log("  dossierStatus: WAITING_CHECKER_2");
    console.log("  currentQcStep: 1");
    console.log("\n==========================================\n");
}

if (import.meta.main) {
    try {
        const data = await seedQcApproveTest();
        printInstructions(data);
        await closeDb();
        Deno.exit(0);
    } catch (error) {
        logger.error("QC approve test seed failed:", error);
        await closeDb();
        Deno.exit(1);
    }
}
