import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDirectConversation, loadMessagingSnapshot } from '@/features/messaging/store';

type ConversationCreateBody = {
  memberId?: string;
};

export async function GET() {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await loadMessagingSnapshot({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    viewer: snapshot.viewer,
    conversations: snapshot.conversations,
    members: snapshot.members,
    pendingMembers: snapshot.pendingMembers,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as ConversationCreateBody;

  if (!payload.memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  const result = await createDirectConversation(payload.memberId, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  if (!result) {
    return NextResponse.json({ error: 'Unable to create conversation' }, { status: 400 });
  }

  return NextResponse.json(result, { status: 201 });
}
