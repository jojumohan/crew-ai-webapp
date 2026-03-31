import { auth } from '@/auth';
import MessagingWorkspace from '@/features/messaging/MessagingWorkspace';
import { loadMessagingSnapshot } from '@/features/messaging/store';

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null } | undefined;

  const snapshot = await loadMessagingSnapshot({
    id: user?.id,
    name: user?.name,
  });

  return <MessagingWorkspace initialSnapshot={snapshot} />;
}
