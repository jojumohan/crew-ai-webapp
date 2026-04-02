import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { adminDb } from '@/lib/firebase-admin';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-secret');

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();
    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const existing = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const ref = await adminDb.collection('users').add({
      email,
      display_name: displayName,
      username: email.split('@')[0],
      password_hash,
      role: 'staff',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const user = { id: ref.id, email, displayName };
    const token = await new SignJWT({ sub: ref.id, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    return NextResponse.json({ user, token });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
