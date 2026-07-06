import { db } from './db/db-conn.ts';
import { dossierFiles } from './db/schemas/dossier-file.ts';

const rows = await db
    .select({ filePath: dossierFiles.filePath })
    .from(dossierFiles);

const directFiles = rows.filter(r => {
    const parts = r.filePath.split('/');
    return parts.length === 2 && parts[0] === 'raw';
});

console.log('Direct files in raw:', JSON.stringify(directFiles, null, 2));
