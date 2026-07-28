import { assertEquals, assertExists } from "@std/assert";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { groupMembers } from "../db/schemas/group_members.ts";
import { groups } from "../db/schemas/groups.ts";
import { userProfiles } from "../db/schemas/index.ts";
import {
    AssignmentStatus,
    DossierStatus,
    EntityType,
    WorkerRole,
} from "../db/schemas/workflow-constants.ts";
import { hashPassword } from "../libs/helpers/password.ts";
import {
    canReopenCompletedMakerDossier,
    isActorPickedForFieldSplitDossier,
    resolveFieldSplitDossierOrdinal,
    resolveWorkableMakerAssignmentForActor,
} from "../modules/data-entry/maker-assignment-resolve.ts";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
} from "../modules/group/group-assignment-guards.ts";
import { FolderService } from "../modules/folder/folder-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_PREFIX = `test-maker-resolve/${crypto.randomUUID()}`;

async function createEditorUser(suffix: string) {
    const passwordHash = await hashPassword("Test@sohoa2026");
    const [profile] = await db.insert(userProfiles).values({
        email: `${TEST_PREFIX}-${suffix}@test.local`,
        fullName: `Editor ${suffix}`,
        passwordHash,
    }).returning();
    return profile;
}

Deno.test("resolveFieldSplitDossierOrdinal uses pool index plus start ordinal", () => {
    const editorIds = new Set(["editor-a", "editor-b"]);
    const active = buildActiveMakerIndex([
        { dossierId: "d-done", assigneeId: "editor-a" },
    ]);
    const completed = buildCompletedMakerIndex([]);

    assertEquals(
        resolveFieldSplitDossierOrdinal({
            dossierId: "d-new",
            targets: [
                { dossierId: "d-done", folderId: "f1", status: DossierStatus.ENTRY_PROCESSING },
                { dossierId: "d-new", folderId: "f1", status: DossierStatus.READY_FOR_ENTRY },
            ],
            activeMakerIndex: active,
            completedMakerIndex: completed,
            editorIds,
        }),
        1,
    );
});

Deno.test("resolveFieldSplitDossierOrdinal falls back to full index for partial assignments", () => {
    const editorIds = new Set(["editor-a", "editor-b"]);
    const active = buildActiveMakerIndex([
        { dossierId: "d-partial", assigneeId: "editor-a" },
    ]);
    const completed = buildCompletedMakerIndex([]);

    assertEquals(
        resolveFieldSplitDossierOrdinal({
            dossierId: "d-partial",
            targets: [
                { dossierId: "d-partial", folderId: "f1", status: DossierStatus.ENTRY_PROCESSING },
                { dossierId: "d-next", folderId: "f1", status: DossierStatus.READY_FOR_ENTRY },
            ],
            activeMakerIndex: active,
            completedMakerIndex: completed,
            editorIds,
        }),
        0,
    );
});

Deno.test("isActorPickedForFieldSplitDossier returns false when editor is not in slot rotation", () => {
    const picked = isActorPickedForFieldSplitDossier({
        actorId: "editor-c",
        dossierOrdinal: 0,
        editorRefs: [
            {
                userId: "editor-a",
                fullName: "A",
                allowedFields: ["Q1.FIELD"],
                permissionSlotCode: "Q1",
                slotSortOrder: 0,
            },
            {
                userId: "editor-b",
                fullName: "B",
                allowedFields: ["Q2.FIELD"],
                permissionSlotCode: "Q2",
                slotSortOrder: 1,
            },
            {
                userId: "editor-c",
                fullName: "C",
                allowedFields: ["Q2.FIELD"],
                permissionSlotCode: "Q2",
                slotSortOrder: 1,
            },
        ],
    });

    assertEquals(picked, false);
});

Deno.test("isActorPickedForFieldSplitDossier returns true for picked editor with slot fields", () => {
    const picked = isActorPickedForFieldSplitDossier({
        actorId: "editor-a",
        dossierOrdinal: 1,
        editorRefs: [
            {
                userId: "editor-a",
                fullName: "A",
                allowedFields: ["HO_SO_LUU_TRU.FOND"],
                permissionSlotCode: "PHONG",
                slotSortOrder: 0,
            },
            {
                userId: "editor-b",
                fullName: "B",
                allowedFields: ["HO_SO_LUU_TRU.MA_HO_SO"],
                permissionSlotCode: "MA",
                slotSortOrder: 1,
            },
        ],
    });

    assertEquals(picked, true);
});

Deno.test("canReopenCompletedMakerDossier excludes ENTRY_PROCESSING partial submit", () => {
    assertEquals(canReopenCompletedMakerDossier(DossierStatus.ENTRY_PROCESSING), false);
    assertEquals(canReopenCompletedMakerDossier(DossierStatus.READY_FOR_ENTRY), true);
    assertEquals(canReopenCompletedMakerDossier(DossierStatus.CHECKER_1_REJECTED), true);
});

Deno.test({
    name: "resolveWorkableMakerAssignmentForActor does not reopen completed maker on ENTRY_PROCESSING",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const project = await createTestProject();
    const folderPath = `${TEST_PREFIX}/reopen`;
    const dossierIds: string[] = [];
    const groupIds: string[] = [];

    try {
        const folder = await FolderService.create({
            folderPath,
            folderName: "reopen",
            projectCode: project.projectCode,
        });

        const [group] = await db.insert(groups).values({
            id: `${TEST_PREFIX}-reopen-group`,
            name: `${TEST_PREFIX}-group`,
            projectCode: project.projectCode,
        }).returning();
        groupIds.push(group.id);

        const editor = await createEditorUser("reopen");
        await db.insert(groupMembers).values({
            groupId: group.id,
            userId: editor.id,
            role: "editor",
        });

        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name: "reopen-dossier",
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.ENTRY_PROCESSING,
            assignedGroupId: group.id,
        }).returning();
        dossierIds.push(dossier.id);

        const [completedAssignment] = await db.insert(dossierAssignments).values({
            dossierId: dossier.id,
            assigneeId: editor.id,
            role: WorkerRole.MAKER,
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
        }).returning();

        const assignment = await resolveWorkableMakerAssignmentForActor(
            dossier.id,
            editor.id,
        );

        assertEquals(assignment, null);

        const unchanged = await db.query.dossierAssignments.findFirst({
            where: eq(dossierAssignments.id, completedAssignment.id),
        });
        assertEquals(unchanged?.status, AssignmentStatus.COMPLETED);
    } finally {
        if (dossierIds.length > 0) {
            await db.delete(dossierAssignments).where(
                inArray(dossierAssignments.dossierId, dossierIds),
            );
            await db.delete(dossiers).where(inArray(dossiers.id, dossierIds));
        }
        await db.delete(folders).where(eq(folders.folderPath, folderPath));
        if (groupIds.length > 0) {
            await db.delete(groupMembers).where(inArray(groupMembers.groupId, groupIds));
            await db.delete(groups).where(inArray(groups.id, groupIds));
        }
        await db.delete(userProfiles).where(
            and(eq(userProfiles.email, `${TEST_PREFIX}-reopen@test.local`), isNull(userProfiles.deletedAt)),
        );
        await deleteTestProject(project.projectCode);
    }
});

Deno.test({
    name: "resolveWorkableMakerAssignmentForActor reopens completed maker on READY_FOR_ENTRY",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const project = await createTestProject();
    const folderPath = `${TEST_PREFIX}/reopen-ready`;
    const dossierIds: string[] = [];
    const groupIds: string[] = [];

    try {
        const folder = await FolderService.create({
            folderPath,
            folderName: "reopen-ready",
            projectCode: project.projectCode,
        });

        const [group] = await db.insert(groups).values({
            id: `${TEST_PREFIX}-reopen-ready-group`,
            name: `${TEST_PREFIX}-reopen-ready-group`,
            projectCode: project.projectCode,
        }).returning();
        groupIds.push(group.id);

        const editor = await createEditorUser("reopen-ready");
        await db.insert(groupMembers).values({
            groupId: group.id,
            userId: editor.id,
            role: "editor",
        });

        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name: "reopen-ready-dossier",
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.READY_FOR_ENTRY,
            assignedGroupId: group.id,
        }).returning();
        dossierIds.push(dossier.id);

        const [completedAssignment] = await db.insert(dossierAssignments).values({
            dossierId: dossier.id,
            assigneeId: editor.id,
            role: WorkerRole.MAKER,
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
        }).returning();

        const assignment = await resolveWorkableMakerAssignmentForActor(
            dossier.id,
            editor.id,
        );

        assertExists(assignment);
        assertEquals(assignment.id, completedAssignment.id);
        assertEquals(assignment.status, AssignmentStatus.IN_PROGRESS);
        assertEquals(assignment.completedAt, null);
    } finally {
        if (dossierIds.length > 0) {
            await db.delete(dossierAssignments).where(
                inArray(dossierAssignments.dossierId, dossierIds),
            );
            await db.delete(dossiers).where(inArray(dossiers.id, dossierIds));
        }
        await db.delete(folders).where(eq(folders.folderPath, folderPath));
        if (groupIds.length > 0) {
            await db.delete(groupMembers).where(inArray(groupMembers.groupId, groupIds));
            await db.delete(groups).where(inArray(groups.id, groupIds));
        }
        await db.delete(userProfiles).where(
            and(eq(userProfiles.email, `${TEST_PREFIX}-reopen-ready@test.local`), isNull(userProfiles.deletedAt)),
        );
        await deleteTestProject(project.projectCode);
    }
});

Deno.test({
    name: "resolveWorkableMakerAssignmentForActor creates assignment from group pool",
    sanitizeResources: false,
    sanitizeOps: false,
}, async () => {
    const project = await createTestProject();
    const folderPath = `${TEST_PREFIX}/ensure`;
    const dossierIds: string[] = [];
    const groupIds: string[] = [];

    try {
        const folder = await FolderService.create({
            folderPath,
            folderName: "ensure",
            projectCode: project.projectCode,
        });

        const [group] = await db.insert(groups).values({
            id: `${TEST_PREFIX}-ensure-group`,
            name: `${TEST_PREFIX}-ensure-group`,
            projectCode: project.projectCode,
            metadataPermissionConfigId: null,
        }).returning();
        groupIds.push(group.id);

        const editor = await createEditorUser("ensure");
        await db.insert(groupMembers).values({
            groupId: group.id,
            userId: editor.id,
            role: "editor",
        });

        const [dossier] = await db.insert(dossiers).values({
            folderId: folder.id,
            folderPath,
            name: "ensure-dossier",
            entityType: EntityType.DOCUMENT,
            status: DossierStatus.READY_FOR_ENTRY,
            assignedGroupId: group.id,
        }).returning();
        dossierIds.push(dossier.id);

        const assignment = await resolveWorkableMakerAssignmentForActor(
            dossier.id,
            editor.id,
        );

        assertExists(assignment);
        assertEquals(assignment.assigneeId, editor.id);
        assertEquals(assignment.status, AssignmentStatus.IN_PROGRESS);
        assertEquals(assignment.dossier?.status, DossierStatus.ENTRY_PROCESSING);
    } finally {
        if (dossierIds.length > 0) {
            await db.delete(dossierAssignments).where(
                inArray(dossierAssignments.dossierId, dossierIds),
            );
            await db.delete(dossiers).where(inArray(dossiers.id, dossierIds));
        }
        await db.delete(folders).where(eq(folders.folderPath, folderPath));
        if (groupIds.length > 0) {
            await db.delete(groupMembers).where(inArray(groupMembers.groupId, groupIds));
            await db.delete(groups).where(inArray(groups.id, groupIds));
        }
        await db.delete(userProfiles).where(
            and(eq(userProfiles.email, `${TEST_PREFIX}-ensure@test.local`), isNull(userProfiles.deletedAt)),
        );
        await deleteTestProject(project.projectCode);
    }
});
