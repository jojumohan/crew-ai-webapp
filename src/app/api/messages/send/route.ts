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

      // Email agent gets its own channel so it always has inbox context
      const channel = targetData?.username === 'agent_email' ? 'email' : 'chat';

      // Call the real crew AI bot
      const res = await fetch(`${agentUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: senderName || 'User',
          message: text,
          channel,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json();
      let replyText = data.reply || "Sorry, I couldn't process that.";

      // If agent wants to send an email, execute it and replace reply with confirmation
      for (const action of (data.actions || [])) {
        if (action.type === 'email_send' && action.to) {
          try {
            const sendRes = await fetch(`${agentUrl}/email/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: action.to, subject: action.subject, body: action.body }),
            });
            const sendData = await sendRes.json();
            if (sendData.ok) {
              replyText = `✅ Done! I've sent the email.\n\n**To:** ${action.to}\n**Subject:** ${action.subject}\n\nLet me know if you need anything else.`;
            } else {
              replyText = `❌ I tried to send the email but something went wrong. Please try again.`;
            }
          } catch {
            replyText = `❌ Failed to send the email — network error. Please try again.`;
          }
        }
      }

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
