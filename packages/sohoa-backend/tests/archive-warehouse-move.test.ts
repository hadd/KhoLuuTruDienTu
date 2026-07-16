import { assertEquals, assertRejects } from "@std/assert";
import {
    executeWarehouseFileMove,
    setUpdateFileRecordOverrideForTests,
} from "../modules/archive/archive-warehouse-move.ts";
import {
    setCopyStorageObjectOverrideForTests,
    setDeleteStorageObjectOverrideForTests,
    setStatStorageObjectOverrideForTests,
    setStorageObjectExistsOverrideForTests,
} from "../modules/archive/archive-warehouse-storage.ts";

const SOURCE_PATH = "raw/test/source/doc.pdf";
const DEST_PATH = "raw/test/target/doc.pdf";

function resetOverrides() {
    setCopyStorageObjectOverrideForTests(null);
    setDeleteStorageObjectOverrideForTests(null);
    setStatStorageObjectOverrideForTests(null);
    setStorageObjectExistsOverrideForTests(null);
    setUpdateFileRecordOverrideForTests(null);
}

function baseMoveInput() {
    return {
        file: {
            id: crypto.randomUUID(),
            fileName: "doc.pdf",
            filePath: SOURCE_PATH,
            fileSizeKb: 1,
        },
        source: { id: crypto.randomUUID() },
        target: { id: crypto.randomUUID(), folderPath: "raw/test/target" },
    };
}

Deno.test("executeWarehouseFileMove keeps filename when destination path is free", async () => {
    setStorageObjectExistsOverrideForTests(async () => false);
    setCopyStorageObjectOverrideForTests(async (_src, dest) => dest);
    setStatStorageObjectOverrideForTests(async () => ({ size: 1024 }));
    setUpdateFileRecordOverrideForTests(async () => {});
    setDeleteStorageObjectOverrideForTests(async () => {});

    try {
        const result = await executeWarehouseFileMove(baseMoveInput());

        assertEquals(result.destPath, DEST_PATH);
        assertEquals(result.destFileName, "doc.pdf");
        assertEquals(result.renamed, false);
    } finally {
        resetOverrides();
    }
});

Deno.test("executeWarehouseFileMove happy path copies, updates DB, deletes source", async () => {
    const calls: string[] = [];

    setStorageObjectExistsOverrideForTests(async () => false);
    setCopyStorageObjectOverrideForTests(async (src, dest) => {
        calls.push(`copy:${src}->${dest}`);
        return dest;
    });
    setStatStorageObjectOverrideForTests(async () => ({ size: 2048 }));
    setUpdateFileRecordOverrideForTests(async () => {
        calls.push("db:update");
    });
    setDeleteStorageObjectOverrideForTests(async (key) => {
        calls.push(`delete:${key}`);
    });

    try {
        const result = await executeWarehouseFileMove(baseMoveInput());

        assertEquals(result.destPath, DEST_PATH);
        assertEquals(result.destFileName, "doc.pdf");
        assertEquals(result.renamed, false);
        assertEquals(result.fileSizeKb, 2);
        assertEquals(calls.includes(`copy:${SOURCE_PATH}->${DEST_PATH}`), true);
        assertEquals(calls.includes("db:update"), true);
        assertEquals(calls.includes(`delete:${SOURCE_PATH}`), true);
        assertEquals(calls.indexOf("db:update") > calls.indexOf(`copy:${SOURCE_PATH}->${DEST_PATH}`), true);
        assertEquals(
            calls.indexOf(`delete:${SOURCE_PATH}`) > calls.indexOf("db:update"),
            true,
        );
    } finally {
        resetOverrides();
    }
});

Deno.test("executeWarehouseFileMove compensates dest when DB update fails", async () => {
    const deleted: string[] = [];

    setStorageObjectExistsOverrideForTests(async () => false);
    setCopyStorageObjectOverrideForTests(async (_src, dest) => dest);
    setStatStorageObjectOverrideForTests(async () => ({ size: 1024 }));
    setUpdateFileRecordOverrideForTests(async () => {
        throw new Error("db update failed");
    });
    setDeleteStorageObjectOverrideForTests(async (key) => {
        deleted.push(key);
    });

    try {
        await assertRejects(
            () => executeWarehouseFileMove(baseMoveInput()),
            Error,
            "db update failed",
        );

        assertEquals(deleted.includes(DEST_PATH), true);
        assertEquals(deleted.includes(SOURCE_PATH), false);
    } finally {
        resetOverrides();
    }
});

Deno.test("executeWarehouseFileMove does not update DB when copy fails", async () => {
    let dbCalled = false;

    setStorageObjectExistsOverrideForTests(async () => false);
    setCopyStorageObjectOverrideForTests(async () => {
        throw new Error("copy failed");
    });
    setUpdateFileRecordOverrideForTests(async () => {
        dbCalled = true;
    });
    setDeleteStorageObjectOverrideForTests(async () => {
        throw new Error("should not delete");
    });

    try {
        await assertRejects(
            () => executeWarehouseFileMove(baseMoveInput()),
            Error,
            "copy failed",
        );
        assertEquals(dbCalled, false);
    } finally {
        resetOverrides();
    }
});

Deno.test("executeWarehouseFileMove compensates dest when stat fails after copy", async () => {
    const deleted: string[] = [];

    setStorageObjectExistsOverrideForTests(async () => false);
    setCopyStorageObjectOverrideForTests(async (_src, dest) => dest);
    setStatStorageObjectOverrideForTests(async () => {
        throw new Error("stat failed");
    });
    setDeleteStorageObjectOverrideForTests(async (key) => {
        deleted.push(key);
    });
    setUpdateFileRecordOverrideForTests(async () => {
        throw new Error("db should not run");
    });

    try {
        await assertRejects(
            () => executeWarehouseFileMove(baseMoveInput()),
            Error,
            "stat failed",
        );

        assertEquals(deleted.includes(DEST_PATH), true);
    } finally {
        resetOverrides();
    }
});
