import { db } from "../../db/db-conn.ts";
import { duplicateDetectionRules } from "../../db/schemas/index.ts";

async function main() {
    console.log("Seeding duplicate detection rules...");

    await db.insert(duplicateDetectionRules).values([
        {
            ruleKey: "DOSSIER_NAME",
            isEnabled: true,
            description: "Trùng lặp tên hồ sơ",
        },
        {
            ruleKey: "DOSSIER_CODE",
            isEnabled: true,
            description: "Trùng lặp mã hồ sơ",
            dossierCodeFieldKey: "dossier_code",
        },
        {
            ruleKey: "FILE_NAME_STRICT",
            isEnabled: true,
            description: "Trùng lặp tên tài liệu (cùng hồ sơ, mã hoặc phông)",
        },
        {
            ruleKey: "DOCUMENT_METADATA_SIMILARITY",
            isEnabled: true,
            description: "Trùng lặp siêu dữ liệu (trên 85%)",
            dossierSummaryFieldKey: "summary",
        }
    ]).onConflictDoUpdate({
        target: duplicateDetectionRules.ruleKey,
        set: {
            isEnabled: true,
        }
    });

    console.log("Done seeding duplicate detection rules.");
}

main().catch(console.error).finally(() => process.exit(0));
