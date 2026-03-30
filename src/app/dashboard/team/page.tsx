import { auth } from '@/auth';
import Header from '@/components/Header/Header';
import { getWorkspaceSnapshot } from '@/lib/workspace';
import styles from '../page.module.css';
import WorkspaceManager from './WorkspaceManager';

export default async function TeamPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const snapshot = await getWorkspaceSnapshot();

  return (
    <>
      <Header title="Workspace" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Teams, projects, and channels</h1>
          <p>
            Structure the app like Microsoft Teams with dedicated teams, project channels, and managed member access.
          </p>
        </div>
        <WorkspaceManager
          initialData={snapshot}
          isAdmin={isAdmin}
          currentUserId={session?.user?.id ?? ''}
        />
      </div>
    </>
  );
}
