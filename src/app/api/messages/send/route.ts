import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// This API handles sending messages and AUTOMATICALLY triggers agent replies
export async function POST(req: NextRequest) {
  const { senderId, targetId, text } = await req.json();
  if (!senderId || !targetId || !text) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const conversationId = [senderId, targetId].sort().join('_');
  const timestamp = new Date();

  try {
    // 1. Save user message
    await db.collection('messages').add({
      conversationId,
      senderId,
      text,
      timestamp,
    });

    // 2. Check if the target is an AI Agent
    // We'll check if the role is 'agent' or if the ID starts with 'agent_'
    const targetSnap = await db.collection('users').doc(targetId).get();
    const targetData = targetSnap.exists ? targetSnap.data() : null;

    if (targetData?.role === 'agent' || targetId.startsWith('agent_')) {
      // Trigger AI Brain
      const systemPrompt = `You are ${targetData?.display_name || 'an AI Agent'} at Aronlabz. 
      You are a full team member. Be professional, helpful, and concise. 
      Respond to the user naturally in the team chat.`;

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const replyText = completion.choices[0].message.content || "I'm sorry, I couldn't process that.";

      // 3. Save agent's reply
      await db.collection('messages').add({
        conversationId,
        senderId: targetId,
        text: replyText,
        timestamp: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
