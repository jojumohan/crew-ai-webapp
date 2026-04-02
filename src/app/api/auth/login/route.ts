import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { adminDb } from '@/lib/firebase-admin';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-secret');

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const snap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    const valid = await bcrypt.compare(password, data.password_hash ?? '');
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = { id: doc.id, email: data.email, displayName: data.display_name, avatarUrl: data.avatar_url };
    const token = await new SignJWT({ sub: doc.id, email: data.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    return NextResponse.json({ user, token });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
