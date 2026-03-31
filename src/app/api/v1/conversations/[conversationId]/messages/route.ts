import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { loadConversationMessages } from '@/features/messaging/store';

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { conversationId } = await context.params;
  const messages = await loadConversationMessages(conversationId, {
    id: user.id,
    name: user.name,
  });

  if (!messages) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json({
    conversationId,
    messages,
  });
}
