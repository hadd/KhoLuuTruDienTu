import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { digitalSignatures } from "../../db/schemas/digital-signature.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

/** PDF files eligible for first-time sign or re-sign (includes already-signed). */
export async function findSignableFilesByDossierId(dossierId: string) {
    return await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        orderBy: asc(dossierFiles.fileName),
    });
}

export async function findSignableFilesByDossierIds(dossierIds: string[]) {
    if (!dossierIds.length) return [];

    return await db.query.dossierFiles.findMany({
        where: inArray(dossierFiles.dossierId, dossierIds),
        orderBy: asc(dossierFiles.fileName),
    });
}

export async function findFileById(fileId: string) {
    return await db.query.dossierFiles.findFirst({
        where: eq(dossierFiles.id, fileId),
    });
}

export async function findDossierById(dossierId: string) {
    return await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: {
            id: true,
            name: true,
            status: true,
        },
    });
}

export async function listFileSignStatusByDossierId(dossierId: string) {
    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        orderBy: asc(dossierFiles.fileName),
        columns: {
            id: true,
            fileName: true,
            filePath: true,
            signedFilePath: true,
            signedAt: true,
        },
    });

    const signatures = await db
        .select({
            id: digitalSignatures.id,
            fileId: digitalSignatures.fileId,
            certificateSubject: digitalSignatures.certificateSubject,
            certificateThumbprint: digitalSignatures.certificateThumbprint,
            certificateIssuer: digitalSignatures.certificateIssuer,
            certificateValidFrom: digitalSignatures.certificateValidFrom,
            certificateValidTo: digitalSignatures.certificateValidTo,
            signedAt: digitalSignatures.signedAt,
            signedBy: digitalSignatures.signedBy,
            signerName: userProfiles.fullName,
        })
        .from(digitalSignatures)
        .leftJoin(userProfiles, eq(digitalSignatures.signedBy, userProfiles.id))
        .where(inArray(
            digitalSignatures.fileId,
            files.map((file) => file.id),
        ))
        .orderBy(desc(digitalSignatures.signedAt));

    const signatureByFileId = new Map(
        signatures.map((signature) => [signature.fileId, signature]),
    );

    return files.map((file) => ({
        ...file,
        isSigned: Boolean(file.signedFilePath),
        signature: signatureByFileId.get(file.id) ?? null,
    }));
}

export async function listSignaturesByDossierId(dossierId: string) {
    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        columns: { id: true },
    });

    if (!files.length) return [];

    return await db
        .select({
            id: digitalSignatures.id,
            fileId: digitalSignatures.fileId,
            certificateSubject: digitalSignatures.certificateSubject,
            certificateThumbprint: digitalSignatures.certificateThumbprint,
            certificateIssuer: digitalSignatures.certificateIssuer,
            certificateValidFrom: digitalSignatures.certificateValidFrom,
            certificateValidTo: digitalSignatures.certificateValidTo,
            signedAt: digitalSignatures.signedAt,
            signedBy: digitalSignatures.signedBy,
            signerName: userProfiles.fullName,
        })
        .from(digitalSignatures)
        .leftJoin(userProfiles, eq(digitalSignatures.signedBy, userProfiles.id))
        .where(inArray(
            digitalSignatures.fileId,
            files.map((file) => file.id),
        ))
        .orderBy(desc(digitalSignatures.signedAt));
}

export async function markFileSigned(params: {
    fileId: string;
    signedFilePath: string;
    signedBy: string;
    certificateSubject: string;
    certificateThumbprint: string;
    certificateIssuer: string;
    certificateValidFrom?: Date | null;
    certificateValidTo?: Date | null;
}) {
    const now = new Date();

    await db.transaction(async (tx) => {
        await tx
            .update(dossierFiles)
            .set({
                signedFilePath: params.signedFilePath,
                signedAt: now,
            })
            .where(eq(dossierFiles.id, params.fileId));

        await tx.insert(digitalSignatures).values({
            fileId: params.fileId,
            signedBy: params.signedBy,
            certificateSubject: params.certificateSubject,
            certificateThumbprint: params.certificateThumbprint,
            certificateIssuer: params.certificateIssuer,
            certificateValidFrom: params.certificateValidFrom ?? null,
            certificateValidTo: params.certificateValidTo ?? null,
            signedAt: now,
        });
    });
}
