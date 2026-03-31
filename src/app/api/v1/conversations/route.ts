import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { loadMessagingSnapshot } from '@/features/messaging/store';

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await loadMessagingSnapshot({
    id: user.id,
    name: user.name,
  });

  return NextResponse.json({
    viewer: snapshot.viewer,
    conversations: snapshot.conversations,
  });
}
