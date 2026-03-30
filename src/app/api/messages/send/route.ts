import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  const { senderId, targetId, text, senderName } = await req.json();
  if (!senderId || !targetId || !text) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const conversationId = [senderId, targetId].sort().join('_');

  try {
    // 1. Save user message
    await db.collection('messages').add({
      conversationId,
      senderId,
      text,
      timestamp: new Date(),
    });

    // 2. Check if target is an AI Agent
    const targetSnap = await db.collection('users').doc(targetId).get();
    const targetData = targetSnap.exists ? targetSnap.data() : null;

    if (targetData?.role === 'agent') {
      const agentUrl = process.env.AGENT_URL;
      if (!agentUrl) {
        console.warn('AGENT_URL not set');
        return NextResponse.json({ ok: true });
      }

      // Call the real crew AI bot
      const res = await fetch(`${agentUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: senderName || 'User',
          message: text,
          channel: 'chat',
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json();
      const replyText = data.reply || "Sorry, I couldn't process that.";

      // 3. Save agent reply
      await db.collection('messages').add({
        conversationId,
        senderId: targetId,
        text: replyText,
        timestamp: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Send message error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
