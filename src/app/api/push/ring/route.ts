import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import webpush from 'web-push';
import { db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:aieurekaminds@gmail.com',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || ''
  );
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, body, targetUserId } = await req.json();
  const callerName = session.user?.name ?? 'Someone';
  const callerId = session.user?.id ?? '';

  try {
    let query = db.collection('pushSubscriptions');
    
    // If targetUserId is set, we only ring that specific member
    // Otherwise, we ring the whole team (excluding the caller)
    let snap;
    if (targetUserId) {
      snap = await query.where('userId', '==', targetUserId).get();
    } else {
      snap = await query.where('userId', '!=', callerId).get();
    }

    const payload = JSON.stringify({
      title: title || (targetUserId ? `📞 Direct call from ${callerName}` : `📞 Incoming call from ${callerName}`),
      body: body || (targetUserId ? 'Incoming contact — Tap to accept' : 'Tap to open Aronlabz Teams'),
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'aronlabz-ring',
      renotify: true,
      requireInteraction: true,
      sound: '/ring.mp3',
      url: '/dashboard?action=join',
      actions: [
        { action: 'join', title: '✅ Join' },
        { action: 'dismiss', title: '❌ Dismiss' }
      ]
    });

    const results = await Promise.allSettled(
      snap.docs.map((doc) => {
        const sub = doc.data();
        return webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return NextResponse.json({ ok: true, sent, total: snap.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
