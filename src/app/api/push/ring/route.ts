import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import webpush from 'web-push';
import mysql from 'mysql2/promise';

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:aieurekaminds@gmail.com',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || ''
  );
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, body } = await req.json();
  const callerName = session.user?.name ?? 'Someone';

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await conn.execute<any[]>(
      'SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_id != ?',
      [session.user?.id ?? '']
    );
    await conn.end();

    const payload = JSON.stringify({
      title: title || `📞 Incoming call from ${callerName}`,
      body: body || 'Tap to open Aronlabz Teams',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'aronlabz-ring',
      renotify: true,
      requireInteraction: true,
      sound: '/ring.mp3',
      url: '/dashboard',
    });

    const results = await Promise.allSettled(
      rows.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok: true, sent, total: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
