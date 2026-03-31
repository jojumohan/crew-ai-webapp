import postgres from 'postgres';

export type DatabaseClient = ReturnType<typeof postgres>;

let sqlClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient | null {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    });
  }

  return sqlClient;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
