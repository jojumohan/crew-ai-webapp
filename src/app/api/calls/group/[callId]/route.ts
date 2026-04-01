import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminDb } from '@/lib/firebase-admin';

// PATCH /api/calls/group/[callId] - Update group call (join, leave, end)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string } | undefined;
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { callId } = await params;
    const body = await req.json();
    const { action, ...data } = body;

    const callRef = adminDb.collection('group_calls').doc(callId);
    const callSnap = await callRef.get();

    if (!callSnap.exists) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const callData = callSnap.data();

    // Check if user is allowed to interact with this call
    const isInvited = callData?.invitedIds?.includes(user.id);
    const isInitiator = callData?.initiatorId === user.id;
    
    if (!isInvited && !isInitiator) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    switch (action) {
      case 'join': {
        // Add user to participants
        const currentParticipants = callData?.participants || [];
        const alreadyJoined = currentParticipants.find((p: any) => p.id === user.id);
        
        if (!alreadyJoined) {
          await callRef.update({
            participants: [...currentParticipants, {
              id: user.id,
              name: (session?.user as any)?.name || 'Unknown',
              joinedAt: new Date().toISOString(),
              audio: true,
              video: callData?.type === 'video',
            }],
            status: 'active',
          });
        }
        break;
      }

      case 'leave': {
        // Remove user from participants
        const currentParticipants = callData?.participants || [];
        await callRef.update({
          participants: currentParticipants.filter((p: any) => p.id !== user.id),
        });
        break;
      }

      case 'end': {
        // Only initiator can end the call
        if (!isInitiator) {
          return NextResponse.json({ error: 'Only initiator can end the call' }, { status: 403 });
        }
        
        await callRef.update({
          status: 'ended',
          endedAt: new Date().toISOString(),
        });
        break;
      }

      case 'update_participant': {
        // Update participant audio/video state
        const currentParticipants = callData?.participants || [];
        await callRef.update({
          participants: currentParticipants.map((p: any) => 
            p.id === user.id ? { ...p, ...data } : p
          ),
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Group call patch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/calls/group/[callId] - Get group call details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const session = await auth();
    const user = session?.user as { id?: string } | undefined;
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { callId } = await params;
    
    const callRef = adminDb.collection('group_calls').doc(callId);
    const callSnap = await callRef.get();

    if (!callSnap.exists) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const callData = callSnap.data();

    // Check if user is invited or participant
    const isInvited = callData?.invitedIds?.includes(user.id);
    const isParticipant = callData?.participants?.find((p: any) => p.id === user.id);
    
    if (!isInvited && !isParticipant) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      id: callId,
      ...callData,
    });

  } catch (error: any) {
    console.error('Group call get error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
