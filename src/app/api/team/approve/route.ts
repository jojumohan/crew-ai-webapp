import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import mysql from 'mysql2/promise';

async function getConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

// POST — approve or reject a pending user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, action } = await req.json(); // action: 'approve' | 'reject'
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const conn = await getConn();
  if (action === 'approve') {
    await conn.execute('UPDATE users SET status = ? WHERE id = ?', ['active', id]);
  } else {
    await conn.execute('DELETE FROM users WHERE id = ? AND status = ?', [id, 'pending']);
  }
  await conn.end();
  return NextResponse.json({ ok: true });
}
