import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';

// One-time seed: creates admin user in Firestore if not exists
// Call: POST /api/seed  with header x-seed-secret matching SEED_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret');
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await db
    .collection('users')
    .where('username', '==', 'joju')
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ ok: true, message: 'Admin user already exists' });
  }

  const hash = await bcrypt.hash('Crew2026!', 12);
  const ref = await db.collection('users').add({
    username: 'joju',
    display_name: 'Joju',
    email: 'aieurekaminds@gmail.com',
    password_hash: hash,
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, id: ref.id, message: 'Admin user created' });
}
