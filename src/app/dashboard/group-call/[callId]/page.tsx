import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import GroupCallRoom from '@/features/calling/GroupCallRoom';

export default async function GroupCallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const { callId } = await params;

  return <GroupCallRoom callId={callId} />;
}
