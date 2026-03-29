import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(`${process.env.AGENT_URL}/meeting/status`, { cache: 'no-store' });
  const data = await res.json();
  return NextResponse.json(data);
}
