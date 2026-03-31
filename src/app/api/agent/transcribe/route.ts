import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Groq({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = (await request.json()) as { transcript?: string };

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const groq = getGroqClient();
    if (!groq) {
      return NextResponse.json(
        { error: 'Transcription notes are not configured in this environment.' },
        { status: 503 }
      );
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
      max_tokens: 1000,
    });

    const notes = completion.choices[0]?.message?.content || 'No notes generated.';

    return NextResponse.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected transcription error';
    console.error('Transcribe API Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
