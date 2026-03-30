import styles from './page.module.css';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className="glass">
          <div className={styles.content}>
            <h1 className="animate-fade-in">Aronlabz Teams</h1>
            <p className={styles.subtitle}>
              Your centralized hub for agents, tasks, and communication.
            </p>
            <div className={styles.actions}>
              <a href="/login" className={styles.btnPrimary}>
                Login
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
