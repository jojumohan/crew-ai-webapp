import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';

// GET — list all users
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await db.collection('users').orderBy('created_at', 'asc').get();
  const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  // Remove password_hash from response
  const safe = users.map(({ password_hash, ...u }: any) => u);
  return NextResponse.json({ users: safe });
}

// POST — add new user (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { username, display_name, email, password, role } = await req.json();
  if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

  const normalizedUsername = username.toLowerCase();
  const existing = await db
    .collection('users')
    .where('username', '==', normalizedUsername)
    .limit(1)
    .get();

  if (!existing.empty) return NextResponse.json({ error: 'Username already exists' }, { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  await db.collection('users').add({
    username: normalizedUsername,
    display_name: display_name || username,
    email: email || null,
    password_hash: hash,
    role: role || 'staff',
    status: 'active',
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

// DELETE — remove user (admin only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  if (String(id) === session.user?.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

  await db.collection('users').doc(id).delete();
  return NextResponse.json({ ok: true });
}
