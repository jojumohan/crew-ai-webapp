import { auth } from '@/auth';
import Header from '@/components/Header/Header';
import MeetRoom from '@/components/MeetRoom/MeetRoom';
import styles from './page.module.css';

const STATS = [
  { label: 'Open Tickets', value: '—', icon: '✦', color: '#3b82f6' },
  { label: 'In Progress', value: '—', icon: '◉', color: '#f59e0b' },
  { label: 'AI Agents', value: '—', icon: '◈', color: '#10b981' },
  { label: 'Team Members', value: '—', icon: '◎', color: '#8b5cf6' },
];

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? 'User';
  const firstName = name.split(' ')[0] ?? 'there';
  const roomName = `aronlabz-team-${process.env.FIREBASE_PROJECT_ID || 'default'}`;

  return (
    <>
      <Header title="Overview" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Good to see you, {firstName} 👋</h1>
          <p>Here's what's happening in your workspace today.</p>
        </div>

        <div className={styles.statsGrid}>
          {STATS.map(({ label, value, icon, color }) => (
            <div key={label} className={`${styles.statCard} glass`}>
              <div className={styles.statIcon} style={{ color }}>{icon}</div>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        <div className={styles.panels}>
          <div className={`${styles.panel} glass`}>
            <h3>Recent Tickets</h3>
            <div className={styles.empty}>
              <span>◇</span>
              <p>No tickets yet</p>
            </div>
          </div>

          <div className={`${styles.panel} glass`} style={{ padding: 0 }}>
             <MeetRoom roomName={roomName} userName={name} />
          </div>

          <div className={`${styles.panel} glass`}>
            <h3>Active Agents</h3>
            <div className={styles.empty}>
              <span>◈</span>
              <p>No agents running</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

