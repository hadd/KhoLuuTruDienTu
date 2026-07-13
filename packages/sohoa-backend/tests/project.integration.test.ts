import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { userProfiles } from "../db/schemas/user_profile.ts";
import { projectProgressHistories } from "../db/schemas/project-progress-history.ts";
import { ProjectStatus } from "../db/schemas/project-constants.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import { ProjectService } from "../modules/project/project-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

async function createTestUser() {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `test-project-${crypto.randomUUID()}@test.local`,
        fullName: "Project Test User",
        passwordHash,
    }).returning();
    return profile.id;
}

Deno.test({
    name: "Project Integration Tests",
    sanitizeResources: false,
    sanitizeOps: false,
}, async (t) => {
    const project = await createTestProject();
    const projectCode = project.projectCode;
    const userId = await createTestUser();

    try {
        await t.step("get returns project with zero extensions", async () => {
            const detail = await ProjectService.get(projectCode);
            assertEquals(detail.projectCode, projectCode);
            assertEquals(detail.extensionCount, 0);
        });

        await t.step("update acceptanceDate creates progress history", async () => {
            const updated = await ProjectService.update(
                projectCode,
                {
                    acceptanceDate: "2026-12-31",
                    changeReason: "Initial acceptance schedule",
                },
                userId,
            );

            assertEquals(updated.acceptanceDate, "2026-12-31");
            assertEquals(updated.status, ProjectStatus.IN_PROGRESS);

            const history = await ProjectService.listProgressHistory(projectCode);
            assertEquals(history.length, 1);
            assertEquals(history[0].extensionNumber, 1);
            assertEquals(history[0].previousAcceptanceDate, null);
            assertEquals(history[0].newAcceptanceDate, "2026-12-31");
            assertEquals(history[0].changeReason, "Initial acceptance schedule");
            assertEquals(history[0].updatedBy, userId);
        });

        await t.step("second acceptanceDate change increments extensionNumber", async () => {
            const updated = await ProjectService.update(
                projectCode,
                {
                    acceptanceDate: "2027-06-30",
                    changeReason: "First extension",
                },
                userId,
            );

            assertEquals(updated.acceptanceDate, "2027-06-30");
            assertEquals(updated.status, ProjectStatus.EXTENDED);

            const history = await ProjectService.listProgressHistory(projectCode);
            assertEquals(history.length, 2);
            assertEquals(history[0].extensionNumber, 2);
            assertEquals(history[0].previousAcceptanceDate, "2026-12-31");
            assertEquals(history[0].newAcceptanceDate, "2027-06-30");
        });

        await t.step("update without changeReason when acceptanceDate changes is rejected", async () => {
            await assertRejects(
                () => ProjectService.update(
                    projectCode,
                    { acceptanceDate: "2028-01-01" },
                    userId,
                ),
            );
        });

        await t.step("list includes active project", async () => {
            const result = await ProjectService.list({ search: projectCode });
            assertEquals(
                result.items.some((item) => item.projectCode === projectCode),
                true,
            );
        });

        await t.step("listOptions returns code and name only", async () => {
            const result = await ProjectService.listOptions({ search: projectCode });
            const item = result.items.find((row) => row.projectCode === projectCode);
            assertExists(item);
            assertEquals(item.projectName, project.projectName);
            assertEquals(Object.keys(item).sort(), ["projectCode", "projectName"]);
        });
    } finally {
        await db.delete(projectProgressHistories).where(
            eq(projectProgressHistories.projectCode, projectCode),
        );
        await db.delete(userProfiles).where(eq(userProfiles.id, userId));
        await deleteTestProject(projectCode);
    }
});

Deno.test({
    name: "Project Integration Tests — duplicate code",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const project = await createTestProject();
    try {
        await assertRejects(() => ProjectService.create({
            projectCode: project.projectCode,
            projectName: "Duplicate",
        }));
    } finally {
        await deleteTestProject(project.projectCode);
    }
});

Deno.test({
    name: "Project Integration Tests — assertProjectExists",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    await assertRejects(() => ProjectService.assertProjectExists("MISSING-PROJECT-CODE"));
});
