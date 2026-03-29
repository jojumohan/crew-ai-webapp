import { auth } from '@/auth';
import Header from '@/components/Header/Header';
import MeetRoom from '@/components/MeetRoom/MeetRoom';
import MemberActions from '@/components/MemberActions/MemberActions';
import TeamChat from '@/components/TeamChat/TeamChat';
import { db } from '@/lib/firebase-admin';
import styles from './page.module.css';


const STATS = [
  { label: 'Open Tickets', value: '—', icon: '✦', color: '#3b82f6' },
  { label: 'In Progress', value: '—', icon: '◉', color: '#f59e0b' },
  { label: 'AI Agents', value: '2', icon: '◈', color: '#10b981' },
  { label: 'Team Members', value: '—', icon: '◎', color: '#8b5cf6' },
];

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ?? '';
  const name = session?.user?.name ?? 'User';
  const firstName = name.split(' ')[0] ?? 'there';
  const roomName = `aronlabz-team-${process.env.FIREBASE_PROJECT_ID || 'default'}`;

// Fetch real team members from Firestore
const membersSnap = await db.collection('users').orderBy('role', 'asc').get();
const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

return (
  <>
    <Header title="Overview" />
    <div className={styles.page}>
      <div className={styles.welcome}>
        <h1>Good to see you, {firstName} 👋</h1>
        <p>Your team is active in your workspace today.</p>
      </div>

      <div className={styles.statsGrid}>
        {STATS.map(({ label, value, icon, color }) => (
          <div key={label} className={`${styles.statCard} glass`}>
            <div className={styles.statIcon} style={{ color }}>{icon}</div>
            <div className={styles.statValue}>{label === 'Team Members' ? members.length : value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.panels}>
        <div className={`${styles.panel} glass`}>
          <h3>Team Members</h3>
          <div className={styles.memberList}>
            {members.map((m: any, i) => (
              <div key={i} className={styles.memberRow}>
                <div className={styles.avatarMini}>{m.display_name[0]}</div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.display_name}</span>
                  <span className={styles.memberRole}>
                    {m.role === 'agent' ? '🤖 AI Agent' : '👤 Member'}
                  </span>
                </div>
                <div className={styles.memberActions}>
                   <MemberActions userId={m.id} userName={m.display_name} />
                </div>
              </div>
            ))}
          </div>
        </div>


          <div className={`${styles.panel} glass`} style={{ padding: 0 }}>
             <MeetRoom roomName={roomName} userName={name} />
          </div>

          <div className={`${styles.panel} glass`}>
            <h3>Active Agents</h3>
            <div className={styles.agentActivity}>
               <div className={styles.agentRow}>
                 <span>◈</span>
                 <p><strong>Chief of Staff:</strong> Monitoring standups...</p>
               </div>
               <div className={styles.agentRow}>
                 <span>◈</span>
                 <p><strong>Lead Dev:</strong> Reviewing tickets...</p>
               </div>
            </div>
          </div>
        </div>
      </div>
      <TeamChat currentUserId={userId} />
    </>
  );
}



