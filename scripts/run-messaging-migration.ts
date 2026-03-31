import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the messaging migration.');
  }

  const migrationPath = path.join(process.cwd(), 'database', 'migrations', '0001_phase1_messaging.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    await sql.unsafe(migrationSql);
    console.log('Messaging migration applied successfully.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error';
  console.error(message);
  process.exitCode = 1;
});
