import { NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_URL || 'http://185.190.140.103:8765';

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ online: true, ...data });
  } catch {
    return NextResponse.json({ online: false });
  }
}
