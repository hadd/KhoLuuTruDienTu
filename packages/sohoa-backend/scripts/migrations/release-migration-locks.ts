#!/usr/bin/env -S deno run --allow-env --allow-net

import postgres from "postgres";
import { env } from "../../env.ts";

const sql = postgres(env.DATABASE_URL, { max: 1 });

try {
  const blocked = await sql`
    SELECT
      a.pid,
      a.application_name,
      a.state,
      a.wait_event_type,
      a.wait_event
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    JOIN pg_class c ON c.oid = l.relation
    WHERE a.datname = current_database()
      AND a.pid <> pg_backend_pid()
      AND c.relname = 'dossiers'
    ORDER BY a.pid
  `;

  if (blocked.length > 0) {
    console.log(`Found ${blocked.length} session(s) holding/waiting on dossiers:`);
    for (const row of blocked) {
      console.log(`  pid=${row.pid} app=${row.application_name} state=${row.state}`);
    }
  } else {
    console.log("No blocking dossiers sessions found.");
  }

  const terminated = await sql`
    SELECT
      pg_terminate_backend(a.pid) AS terminated,
      a.pid,
      a.application_name
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    JOIN pg_class c ON c.oid = l.relation
    WHERE a.datname = current_database()
      AND a.pid <> pg_backend_pid()
      AND c.relname = 'dossiers'
  `;

  const ok = terminated.filter((row) => row.terminated).length;
  console.log(`Terminated ${ok} blocking session(s).`);
} finally {
  await sql.end();
}
