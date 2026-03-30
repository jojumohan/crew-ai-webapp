import { auth } from '@/auth';
import Header from '@/components/Header/Header';
import MeetRoom from '@/components/MeetRoom/MeetRoom';
import MemberActions from '@/components/MemberActions/MemberActions';
import { getWorkspaceSnapshot } from '@/lib/workspace';
import styles from './page.module.css';

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? 'User';
  const firstName = name.split(' ')[0] ?? 'there';
  const roomName = `aronlabz-team-${process.env.FIREBASE_PROJECT_ID || 'default'}`;

  const workspace = await getWorkspaceSnapshot();
  const members = workspace.users;
  const teams = workspace.teams;
  const channels = teams.flatMap((team) =>
    team.channels.map((channel) => ({
      ...channel,
      teamName: team.name,
      teamIcon: team.icon,
    }))
  );
  const projectChannels = channels.filter((channel) => channel.kind === 'project');

  const stats = [
    { label: 'Teams', value: String(teams.length), icon: 'TM', color: '#3b82f6' },
    { label: 'Channels', value: String(channels.length), icon: 'CH', color: '#14b8a6' },
    { label: 'Projects', value: String(projectChannels.length), icon: 'PJ', color: '#f59e0b' },
    { label: 'Members', value: String(members.length), icon: 'MB', color: '#8b5cf6' },
  ];

  return (
    <>
      <Header title="Overview" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Good to see you, {firstName}</h1>
          <p>Your workspace now supports teams, project channels, and managed membership.</p>
        </div>

        <div className={styles.statsGrid}>
          {stats.map(({ label, value, icon, color }) => (
            <div key={label} className={`${styles.statCard} glass`}>
              <div className={styles.statIcon} style={{ color }}>
                {icon}
              </div>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        <div className={styles.panels}>
          <div className={`${styles.panel} glass`}>
            <div className={styles.panelTitleRow}>
              <h3>Workspace Pulse</h3>
              <span className={styles.pill}>{teams.length} teams</span>
            </div>

            {teams.length > 0 ? (
              <>
                <div className={styles.workspaceList}>
                  {teams.slice(0, 4).map((team) => (
                    <div key={team.id} className={styles.workspaceRow}>
                      <div className={styles.avatarMini}>{team.icon}</div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{team.name}</span>
                        <span className={styles.memberRole}>
                          {team.memberCount} members · {team.channelCount} channels
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.channelPills}>
                  {channels.slice(0, 6).map((channel) => (
                    <span key={channel.id} className={styles.channelPill}>
                      #{channel.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <span>+</span>
                <p>Create your first team to unlock channels and membership flows.</p>
              </div>
            )}
          </div>

          <div className={`${styles.panel} glass`} style={{ padding: 0 }}>
            <MeetRoom roomName={roomName} userName={name} />
          </div>

          <div className={`${styles.panel} glass`}>
            <div className={styles.panelTitleRow}>
              <h3>Project Channels</h3>
              <span className={styles.pill}>{projectChannels.length}</span>
            </div>

            {projectChannels.length > 0 ? (
              <div className={styles.workspaceList}>
                {projectChannels.slice(0, 5).map((channel) => (
                  <div key={channel.id} className={styles.workspaceRow}>
                    <div className={styles.avatarMini}>{channel.teamIcon}</div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>#{channel.name}</span>
                      <span className={styles.memberRole}>{channel.teamName}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span>#</span>
                <p>Project channels will show up here as soon as they are created.</p>
              </div>
            )}
          </div>

          <div className={`${styles.panel} glass`}>
            <div className={styles.panelTitleRow}>
              <h3>Active Members</h3>
              <span className={styles.pill}>{members.length}</span>
            </div>

            <div className={styles.memberList}>
              {members.slice(0, 6).map((member) => (
                <div key={member.id} className={styles.memberRow}>
                  <div className={styles.avatarMini}>{member.display_name[0]}</div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{member.display_name}</span>
                    <span className={styles.memberRole}>{member.role}</span>
                  </div>
                  <div className={styles.memberActions}>
                    <MemberActions userId={member.id} userName={member.display_name} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
