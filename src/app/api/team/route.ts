import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function getConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

// GET — list all users
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await getConn();
  const [rows] = await conn.execute<any[]>(
    'SELECT id, username, display_name, email, role, status, created_at FROM users ORDER BY created_at ASC'
  );
  await conn.end();
  return NextResponse.json({ users: rows });
}

// POST — add new user (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { username, display_name, email, password, role } = await req.json();
  if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

  const hash = await bcrypt.hash(password, 12);
  const conn = await getConn();
  try {
    await conn.execute(
      'INSERT INTO users (username, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [username, display_name || username, email || null, hash, role || 'staff']
    );
    await conn.end();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.end();
    if (err.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove user (admin only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // Prevent deleting self
  if (String(id) === session.user?.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

  const conn = await getConn();
  await conn.execute('DELETE FROM users WHERE id = ?', [id]);
  await conn.end();
  return NextResponse.json({ ok: true });
}
