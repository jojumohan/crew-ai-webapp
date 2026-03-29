import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/lib/firebase-admin';

// This API allows AI agents to perform autonomous actions like "Ringing the Team"
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { agent_username, action, payload } = await req.json();

  if (action === 'ring_team') {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:aieurekaminds@gmail.com',
      process.env.VAPID_PUBLIC_KEY || '',
      process.env.VAPID_PRIVATE_KEY || ''
    );

    const agentSnap = await db.collection('users').where('username', '==', agent_username).limit(1).get();
    const agentData = agentSnap.empty ? { display_name: 'AI Agent' } : agentSnap.docs[0].data();

    try {
      const snap = await db.collection('pushSubscriptions').get();
      const pushPayload = JSON.stringify({
        title: `📞 Incoming call from ${agentData.display_name}`,
        body: payload.reason || 'Tap to join the group call.',
        icon: '/icon.svg',
        url: '/dashboard',
        tag: 'aronlabz-ring',
        renotify: true,
        requireInteraction: true,
      });

      await Promise.allSettled(
        snap.docs.map((doc) => {
          const sub = doc.data();
          return webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        })
      );

      return NextResponse.json({ ok: true, message: 'Team rang successfully' });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unrecognized action' }, { status: 400 });
}
