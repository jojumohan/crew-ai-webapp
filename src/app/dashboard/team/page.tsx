import { auth } from '@/auth';
import Header from '@/components/Header/Header';
import TeamManager from './TeamManager';
import styles from '../page.module.css';

export default async function TeamPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
    <>
      <Header title="Team" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Team Members</h1>
          <p>{isAdmin ? 'Manage your team — add or remove members.' : 'Your Aronlabz team.'}</p>
        </div>
        <TeamManager isAdmin={isAdmin} />
      </div>
    </>
  );
}
