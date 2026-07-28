import { migrateTt05MetadataLayout } from "../../libs/metadata-normalize.ts";
import type { DossierMetadata } from "../../libs/metadata-types.ts";

const roots = [
    new URL("../../assets/TT05.json", import.meta.url),
    new URL(
        "../../assets/fixtures/tt05/processed/TESST3/TT05_FAKE_01/TT05_FAKE_01.json",
        import.meta.url,
    ),
    new URL(
        "../../assets/fixtures/tt05/processed/TESST3/TT05_FAKE_02/TT05_FAKE_02.json",
        import.meta.url,
    ),
    new URL(
        "../../assets/fixtures/tt05/processed/TESST3/TT05_FAKE_03/TT05_FAKE_03.json",
        import.meta.url,
    ),
    new URL(
        "../../assets/fixtures/tt05/processed/TESST3/TT05_DEMO/TT05_DEMO.json",
        import.meta.url,
    ),
    new URL(
        "../../assets/fixtures/tt05/processed/TESST3/296_CD/296_CD.json",
        import.meta.url,
    ),
];

for (const fileUrl of roots) {
    const path = fileUrl.pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const raw = JSON.parse(await Deno.readTextFile(path)) as DossierMetadata;
    const migrated = migrateTt05MetadataLayout(raw);
    await Deno.writeTextFile(path, `${JSON.stringify(migrated, null, 2)}\n`);
    console.log(`migrated ${path}`);
}
