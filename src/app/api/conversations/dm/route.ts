import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getUserId } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { otherUserId } = await req.json();
  if (!otherUserId) return NextResponse.json({ error: 'Missing otherUserId' }, { status: 400 });

  // Check if DM already exists
  const existing = await adminDb.collection('conversations')
    .where('participants', 'array-contains', userId)
    .where('isGroup', '==', false)
    .get();

  const found = existing.docs.find((d) => {
    const parts: string[] = d.data().participants;
    return parts.includes(otherUserId) && parts.length === 2;
  });

  if (found) {
    const d = found.data();
    const otherDoc = await adminDb.collection('users').doc(otherUserId).get();
    const other = otherDoc.data();
    return NextResponse.json({
      id: found.id,
      name: other?.display_name ?? 'Unknown',
      avatarUrl: other?.avatar_url ?? null,
      otherUserId,
      isGroup: false,
      isOnline: false,
      lastMessageAt: d.lastMessageAt ?? null,
      lastMessagePreview: d.lastMessagePreview ?? null,
    });
  }

  const otherDoc = await adminDb.collection('users').doc(otherUserId).get();
  const other = otherDoc.data();

  const ref = await adminDb.collection('conversations').add({
    participants: [userId, otherUserId],
    isGroup: false,
    createdAt: new Date().toISOString(),
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessagePreview: null,
  });

  return NextResponse.json({
    id: ref.id,
    name: other?.display_name ?? 'Unknown',
    avatarUrl: other?.avatar_url ?? null,
    otherUserId,
    isGroup: false,
    isOnline: false,
    lastMessageAt: null,
    lastMessagePreview: null,
  });
}
