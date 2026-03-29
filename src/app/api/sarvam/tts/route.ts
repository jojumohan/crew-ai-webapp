// POST /api/sarvam/tts
// Convert text to speech using Sarvam AI (Meera voice, en-IN)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [text.slice(0, 500)],
        target_language_code: 'en-IN',
        speaker: 'meera',
        pitch: 0,
        pace: 0.95,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: 'bulbul:v1',
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    const audio = data.audios?.[0] || '';
    return NextResponse.json({ audio });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
