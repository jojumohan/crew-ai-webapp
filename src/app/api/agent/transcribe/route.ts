import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const prompt = `You are an AI assistant listening to a Standup Meeting.
Extract key notes and assignments from the transcript below.
Format it as concise bullet points, mentioning who is doing what, and any key decisions made.

TRANSCRIPT:
${transcript}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1000
    });

    const notes = completion.choices[0]?.message?.content || 'No notes generated.';

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error("Transcribe API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
