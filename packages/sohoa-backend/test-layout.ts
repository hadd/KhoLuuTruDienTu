import { db } from './db/db-conn.ts';
import { dossierFiles } from './db/schemas/dossier-file.ts';

const rows = await db
    .select({ filePath: dossierFiles.filePath })
    .from(dossierFiles);

console.log(JSON.stringify(rows.map(r => r.filePath), null, 2));
