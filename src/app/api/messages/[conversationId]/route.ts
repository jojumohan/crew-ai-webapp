import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await params;

  // Verify user is a participant
  const convDoc = await adminDb.collection('conversations').doc(conversationId).get();
  if (!convDoc.exists || !convDoc.data()?.participants.includes(userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snap = await adminDb.collection('messages')
    .where('conversationId', '==', conversationId)
    .limit(100)
    .get();

  const senderCache: Record<string, { displayName: string; avatarUrl?: string }> = {};
  async function getSender(uid: string) {
    if (senderCache[uid]) return senderCache[uid];
    const doc = await adminDb.collection('users').doc(uid).get();
    const d = doc.data();
    senderCache[uid] = { displayName: d?.display_name ?? 'Unknown', avatarUrl: d?.avatar_url };
    return senderCache[uid];
  }

  const messages = await Promise.all(snap.docs.map(async (doc) => {
    const d = doc.data();
    const sender = await getSender(d.senderId);
    return {
      id: doc.id,
      conversationId: d.conversationId,
      senderId: d.senderId,
      content: d.content ?? null,
      type: d.type ?? 'TEXT',
      status: d.status ?? 'SENT',
      createdAt: d.createdAt,
      replyToId: d.replyToId ?? null,
      sender: { id: d.senderId, ...sender },
      attachments: d.attachments ?? [],
      readReceipts: d.readReceipts ?? [],
    };
  }));

  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return NextResponse.json(messages);
}
