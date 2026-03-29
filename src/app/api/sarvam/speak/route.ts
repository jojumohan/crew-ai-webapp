// POST /api/sarvam/speak
// Pipeline: audio → Sarvam STT → AI Chief of Staff → Sarvam TTS → audio back
// Also saves the exchange as a meeting note on the VPS bot

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const SARVAM_KEY = process.env.SARVAM_API_KEY!;
const AGENT_URL  = process.env.AGENT_URL!;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const speakerName = (session.user as any)?.display_name || session.user?.name || 'User';

  // 1. Get audio blob from multipart form
  const form = await req.formData();
  const audioFile = form.get('audio') as Blob | null;
  if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

  // 2. Sarvam STT — send audio, get transcript
  const sttForm = new FormData();
  sttForm.append('file', audioFile, 'audio.webm');
  sttForm.append('model', 'saarika:v2');
  sttForm.append('language_code', 'en-IN');

  let transcript = '';
  try {
    const sttRes = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY },
      body: sttForm,
      signal: AbortSignal.timeout(20000),
    });
    const sttData = await sttRes.json();
    transcript = sttData.transcript || sttData.text || '';
  } catch (e) {
    console.error('Sarvam STT error:', e);
    return NextResponse.json({ error: 'STT failed' }, { status: 502 });
  }

  if (!transcript.trim()) {
    return NextResponse.json({ error: 'No speech detected' }, { status: 400 });
  }

  // 3. AI Chief of Staff response via VPS bot
  let aiReply = '';
  try {
    const aiRes = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: speakerName, message: transcript }),
      signal: AbortSignal.timeout(30000),
    });
    const aiData = await aiRes.json();
    aiReply = aiData.reply || "I heard you. Could you please repeat that?";
  } catch (e) {
    aiReply = "I heard you. Please continue.";
  }

  // 4. Save as meeting note on VPS
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  try {
    await fetch(`${AGENT_URL}/meeting/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker: speakerName, content: transcript }),
    });
    await fetch(`${AGENT_URL}/meeting/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker: 'AI Chief of Staff', content: aiReply }),
    });
  } catch {}

  // 5. Sarvam TTS — convert AI reply to audio
  let audioBase64 = '';
  try {
    const ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [aiReply.slice(0, 500)],
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
    const ttsData = await ttsRes.json();
    audioBase64 = ttsData.audios?.[0] || '';
  } catch (e) {
    console.error('Sarvam TTS error:', e);
  }

  return NextResponse.json({ transcript, reply: aiReply, audio: audioBase64 });
}
