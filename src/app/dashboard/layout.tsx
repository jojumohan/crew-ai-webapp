import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import styles from './layout.module.css';
import CallProvider from '@/features/calling/CallProvider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect('/login');
  }

  if (!session) {
    redirect('/login');
  }

  return (
    <main className={styles.main}>
      <CallProvider>
        {children}
      </CallProvider>
    </main>
  );
}
