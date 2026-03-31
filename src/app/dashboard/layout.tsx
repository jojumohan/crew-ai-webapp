import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import styles from './layout.module.css';

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

  return <main className={styles.main}>{children}</main>;
}
