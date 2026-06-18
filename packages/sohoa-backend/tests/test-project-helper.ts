import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { projectProgressHistories } from "../db/schemas/project-progress-history.ts";
import { projects } from "../db/schemas/project.ts";
import { ProjectService } from "../modules/project/project-service.ts";

export async function createTestProject() {
    const projectCode = `TST-${crypto.randomUUID()}`.slice(0, 50);
    return await ProjectService.create({
        projectCode,
        projectName: `Test Project ${projectCode}`,
        projectType: "integration",
        investor: "Test Investor",
    });
}

export async function deleteTestProject(projectCode: string) {
    await db.delete(projectProgressHistories).where(
        eq(projectProgressHistories.projectCode, projectCode),
    );
    await db.delete(projects).where(eq(projects.projectCode, projectCode));
}
