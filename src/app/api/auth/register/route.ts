import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  const { username, display_name, email, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const normalizedUsername = username.toLowerCase();

  // Check for existing username
  const existing = await db
    .collection('users')
    .where('username', '==', normalizedUsername)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);

  await db.collection('users').add({
    username: normalizedUsername,
    display_name: display_name || username,
    email: email || null,
    password_hash: hash,
    role: 'staff',
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
