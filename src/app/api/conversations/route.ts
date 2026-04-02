import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('conversations')
    .where('participants', 'array-contains', userId)
    .orderBy('lastMessageAt', 'desc')
    .limit(50)
    .get();

  const userCache: Record<string, { displayName: string; avatarUrl?: string }> = {};
  async function getUser(uid: string) {
    if (userCache[uid]) return userCache[uid];
    const doc = await adminDb.collection('users').doc(uid).get();
    const d = doc.data();
    userCache[uid] = { displayName: d?.display_name ?? 'Unknown', avatarUrl: d?.avatar_url };
    return userCache[uid];
  }

  const conversations = await Promise.all(snap.docs.map(async (doc) => {
    const d = doc.data();
    const otherUserId = d.participants.find((p: string) => p !== userId);
    const other = otherUserId ? await getUser(otherUserId) : null;
    return {
      id: doc.id,
      name: d.isGroup ? d.name : other?.displayName ?? 'Unknown',
      avatarUrl: d.isGroup ? d.avatarUrl : other?.avatarUrl ?? null,
      otherUserId: d.isGroup ? undefined : otherUserId,
      isGroup: d.isGroup ?? false,
      isOnline: false,
      lastMessageAt: d.lastMessageAt ?? null,
      lastMessagePreview: d.lastMessagePreview ?? null,
    };
  }));

  return NextResponse.json(conversations);
}
