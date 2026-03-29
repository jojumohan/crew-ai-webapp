import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Groq } from 'groq-sdk';

// This API handles sending messages and AUTOMATICALLY triggers agent replies
// We moved the Groq initialization INSIDE the function to avoid build errors when the key is missing
export async function POST(req: NextRequest) {
  const { senderId, targetId, text } = await req.json();
  if (!senderId || !targetId || !text) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const conversationId = [senderId, targetId].sort().join('_');
  const timestamp = new Date();

  const apiKey = process.env.GROQ_API_KEY;
  const groq = new Groq({ apiKey: apiKey || 'DUMMY_FOR_BUILD' });

  try {
    // 1. Save user message
    await db.collection('messages').add({
      conversationId,
      senderId,
      text,
      timestamp,
    });

    // 2. Check if the target is an AI Agent
    if (targetId.startsWith('agent_')) {
      if (!apiKey) {
         console.warn("GROQ_API_KEY is missing in production environment.");
         return NextResponse.json({ ok: true, note: "Message saved, but AI brain is missing GROQ_API_KEY." });
      }

      // Fetch target persona from db
      const targetSnap = await db.collection('users').doc(targetId).get();
      const targetData = targetSnap.exists ? targetSnap.data() : { display_name: 'AI Agent' };

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
    console.error("Agent reply error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
