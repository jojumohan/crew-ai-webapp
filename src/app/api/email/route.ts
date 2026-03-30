import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_URL || 'http://185.190.140.103:8765';

// GET /api/email?action=list&max=15
// GET /api/email?action=important
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'list';
  const max    = req.nextUrl.searchParams.get('max') || '15';

  const endpoint = action === 'important' ? '/email/important' : `/email/list?max=${max}`;
  try {
    const r = await fetch(`${AGENT_URL}${endpoint}`, { cache: 'no-store' });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// POST /api/email  — send or reply
// body: { to, subject, body, reply_to_id? }
export async function POST(req: NextRequest) {
  const payload = await req.json();
  try {
    const r = await fetch(`${AGENT_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
