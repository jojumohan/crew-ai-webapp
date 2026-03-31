import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createMessage } from '@/features/messaging/store';

type MessageBody = {
  conversationId?: string;
  body?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as MessageBody;

  if (!payload.conversationId || !payload.body) {
    return NextResponse.json({ error: 'conversationId and body are required' }, { status: 400 });
  }

  const result = await createMessage(
    {
      conversationId: payload.conversationId,
      body: payload.body,
    },
    {
      id: user.id,
      name: user.name,
    }
  );

  if (!result) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json(result, { status: 201 });
}
