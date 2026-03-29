import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// One-time migration endpoint — protected by secret key
export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const results: string[] = [];

  try {
    await conn.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status ENUM('pending','active') NOT NULL DEFAULT 'active' AFTER role
    `);
    results.push('Added status column');
  } catch (e: any) {
    results.push('status column: ' + e.message);
  }

  try {
    await conn.execute(`UPDATE users SET status = 'active' WHERE username = 'joju'`);
    results.push('Set joju as active');
  } catch (e: any) {
    results.push('update joju: ' + e.message);
  }

  try {
    const [rows] = await conn.execute<any[]>('SELECT id, username, status FROM users');
    results.push('Users: ' + JSON.stringify(rows));
  } catch (e: any) {
    results.push('select: ' + e.message);
  }

  await conn.end();
  return NextResponse.json({ ok: true, results });
}
