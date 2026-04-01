import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase/firestore';

// POST /api/calls/group - Create a new group call
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string; name?: string | null } | undefined;
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      conversationId, 
      type = 'voice', 
      invitedIds = [],
      roomUrl,
      roomName 
    } = body;

    if (!conversationId || !roomUrl || !roomName) {
      return NextResponse.json({ 
        error: 'conversationId, roomUrl, and roomName are required' 
      }, { status: 400 });
    }

    // Create the group call document
    const callData = {
      conversationId,
      initiatorId: user.id,
      initiatorName: user.name || 'Unknown',
      roomName,
      roomUrl,
      status: 'ringing',
      type: type as 'voice' | 'video',
      participants: [],
      invitedIds: [...new Set([...invitedIds, user.id])], // Include initiator
      startedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    const callRef = await adminDb.collection('group_calls').add(callData);

    // Send push notifications to invited users
    if (invitedIds.length > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/push/ring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: type === 'video' ? '📹 Incoming Group Video Call' : '📞 Incoming Group Voice Call',
            body: `${user.name || 'Someone'} is calling you${invitedIds.length > 1 ? ' and others' : ''}`,
            targetUserIds: invitedIds,
          }),
        });
      } catch (e) {
        console.error('Failed to send push notifications:', e);
      }
    }

    return NextResponse.json({
      callId: callRef.id,
      ...callData,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Group call creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/calls/group - List active group calls for user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string } | undefined;
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get calls where user is invited or participant
    const callsRef = adminDb.collection('group_calls');
    const invitedQuery = await callsRef
      .where('invitedIds', 'array-contains', user.id)
      .where('status', 'in', ['ringing', 'active'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const calls = invitedQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ calls });

  } catch (error: any) {
    console.error('Group call list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
