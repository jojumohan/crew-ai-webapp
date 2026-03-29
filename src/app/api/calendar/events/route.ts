import { NextResponse } from 'next/server';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'aieurekaminds@gmail.com';
const API_KEY     = process.env.GOOGLE_CALENDAR_API_KEY || 'AIzaSyBvoPWyAXNnMljjDTT2L7MYJ4aUAc-eSFg';

export async function GET() {
  const now = new Date().toISOString();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events` +
    `?key=${API_KEY}&timeMin=${now}&maxResults=20&singleEvents=true&orderBy=startTime`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err?.error?.message || 'Calendar fetch failed' }, { status: res.status });
    }
    const data = await res.json();
    const events = (data.items || []).map((e: any) => ({
      id:       e.id,
      title:    e.summary || '(No title)',
      start:    e.start?.dateTime || e.start?.date,
      end:      e.end?.dateTime   || e.end?.date,
      allDay:   !e.start?.dateTime,
      location: e.location || null,
      desc:     e.description || null,
      link:     e.htmlLink || null,
    }));
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
