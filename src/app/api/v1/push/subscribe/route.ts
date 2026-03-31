import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const subscription = await request.json();
    
    // Save subscription to user profile in Firestore
    // Using a subcollection 'subscriptions' for this user
    const subscriberRef = adminDb
      .collection('messaging_profiles')
      .doc(user.id)
      .collection('subscriptions')
      .doc(Buffer.from(JSON.stringify(subscription)).toString('base64url').slice(0, 100));

    await subscriberRef.set({
      ...subscription,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push-api] subscription failed:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
