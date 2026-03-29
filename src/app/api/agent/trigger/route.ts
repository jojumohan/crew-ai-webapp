import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const AGENT_URL = process.env.AGENT_URL || 'http://185.190.140.103:8765';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action } = await req.json();
  if (!['standup', 'end'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const res = await fetch(`${AGENT_URL}/${action}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    return NextResponse.json({ ok: true, message: text });
  } catch {
    return NextResponse.json({ ok: false, message: 'Agent unreachable' }, { status: 502 });
  }
}
