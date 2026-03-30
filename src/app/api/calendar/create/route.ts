// POST /api/calendar/create
// Creates a Google Calendar event using the Firebase service account.
// The service account must be shared as an Editor on the calendar.
//
// Body: { secret, summary, description?, start, end?, allDay? }
//   start / end: ISO 8601 datetime string OR YYYY-MM-DD for all-day events

import { NextRequest, NextResponse } from 'next/server';
import { createSign } from 'crypto';

const PROJECT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL!;
const PRIVATE_KEY   = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const CALENDAR_ID   = process.env.GOOGLE_CALENDAR_ID || 'aieurekaminds@gmail.com';
const SECRET        = process.env.CALENDAR_CREATE_SECRET || process.env.SEED_SECRET || '';

function base64url(s: string) {
  return Buffer.from(s).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: PROJECT_EMAIL,
    sub: PROJECT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/calendar',
  }));
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(PRIVATE_KEY, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.${sig}`;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${makeJWT()}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Validate secret
  if (SECRET && body.secret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { summary, description = '', start, end, allDay = false } = body;
  if (!summary || !start) {
    return NextResponse.json({ error: 'summary and start are required' }, { status: 400 });
  }

  // Build event body
  const endVal = end || start; // default end = same as start
  const eventBody = allDay
    ? {
        summary,
        description,
        start: { date: start.slice(0, 10) },
        end:   { date: endVal.slice(0, 10) },
      }
    : {
        summary,
        description,
        start: { dateTime: start, timeZone: 'Asia/Kolkata' },
        end:   { dateTime: endVal, timeZone: 'Asia/Kolkata' },
      };

  try {
    const token = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Calendar API error' }, { status: res.status });
    return NextResponse.json({ ok: true, eventId: data.id, link: data.htmlLink });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
