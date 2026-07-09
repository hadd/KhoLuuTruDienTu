import type { SearchDocument } from "@shared/search-engine";
import { db } from "../../../db/db-conn.ts";
import { fonds } from "../../../db/schemas/fond.ts";
import { and, eq, isNull } from "drizzle-orm";

export const FOND_ENTITY_TYPE = "fond";

export async function buildFondSearchDocument(
    fondId: string,
): Promise<SearchDocument | null> {
    const fond = await db.query.fonds.findFirst({
        where: and(eq(fonds.id, fondId), isNull(fonds.deletedAt)),
    });
    if (!fond || !fond.isActive) return null;

    const content = [
        fond.fondName,
        fond.archiveAgency,
        fond.adminstrativeHistory,
        fond.fondType,
    ].filter(Boolean).join("\n");

    return {
        entityType: FOND_ENTITY_TYPE,
        entityId: fond.id,
        title: fond.fondName,
        content,
        fondId: fond.id,
        acl: { fondIds: [fond.id] },
        metadata: {
            archiveAgency: fond.archiveAgency,
            fondType: fond.fondType,
        },
    };
}

export async function indexFondById(fondId: string): Promise<boolean> {
    const { indexDocument, deleteDocument } = await import("@shared/search-engine");
    const doc = await buildFondSearchDocument(fondId);
    if (!doc) {
        await deleteDocument(FOND_ENTITY_TYPE, fondId);
        return false;
    }
    await indexDocument(doc);
    return true;
}
