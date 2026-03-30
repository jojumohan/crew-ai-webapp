'use client';

import { startTransition, useEffect, useState } from 'react';
import type { ChannelKind, TeamRole, WorkspaceSnapshot, WorkspaceTeam } from '@/lib/workspace';
import styles from './workspace.module.css';

const CHANNEL_OPTIONS: Array<{ value: ChannelKind; label: string; hint: string }> = [
  { value: 'project', label: 'Project', hint: 'Delivery work, sprint threads, and launch plans.' },
  { value: 'announcements', label: 'Announcements', hint: 'Leadership updates, launches, and decisions.' },
  { value: 'support', label: 'Support', hint: 'Escalations, triage, and internal help requests.' },
  { value: 'general', label: 'General', hint: 'Broad team discussion and shared context.' },
];

const ROLE_OPTIONS: Array<{ value: TeamRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

type Feedback = {
  type: 'success' | 'error';
  text: string;
};

function getInitials(label: string) {
  return label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getRoleTone(role: string) {
  if (role === 'owner') return styles.roleOwner;
  if (role === 'admin') return styles.roleAdmin;
  if (role === 'agent') return styles.roleAgent;
  return styles.roleMember;
}

function getChannelTone(kind: ChannelKind) {
  if (kind === 'project') return styles.channelProject;
  if (kind === 'announcements') return styles.channelAnnouncements;
  if (kind === 'support') return styles.channelSupport;
  return styles.channelGeneral;
}

export default function WorkspaceManager({
  initialData,
  isAdmin,
  currentUserId,
}: {
  initialData: WorkspaceSnapshot;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [data, setData] = useState(initialData);
  const [selectedTeamId, setSelectedTeamId] = useState(initialData.teams[0]?.id ?? '');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyKey, setBusyKey] = useState('');
  const [showTeamForm, setShowTeamForm] = useState(initialData.teams.length === 0 && isAdmin);
  const [showChannelForm, setShowChannelForm] = useState(initialData.teams.length > 0 && isAdmin);
  const [showMemberForm, setShowMemberForm] = useState(initialData.teams.length > 0 && isAdmin);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', icon: '' });
  const [channelForm, setChannelForm] = useState<{ name: string; description: string; kind: ChannelKind }>({
    name: '',
    description: '',
    kind: 'project',
  });
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'member' as TeamRole });

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const nextSelectedTeam = data.teams.find((team) => team.id === selectedTeamId);
    if (!nextSelectedTeam) {
      setSelectedTeamId(data.teams[0]?.id ?? '');
    }
  }, [data.teams, selectedTeamId]);

  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? null;
  const selectedTeamMemberIds = new Set(selectedTeam?.members.map((member) => member.userId) ?? []);
  const availableUsers = data.users.filter((user) => !selectedTeamMemberIds.has(user.id));
  const projectChannels = selectedTeam?.channels.filter((channel) => channel.kind === 'project') ?? [];
  const coreChannels = selectedTeam?.channels.filter((channel) => channel.kind !== 'project') ?? [];

  useEffect(() => {
    if (!availableUsers.length) {
      if (memberForm.userId) setMemberForm((current) => ({ ...current, userId: '' }));
      return;
    }

    const stillAvailable = availableUsers.some((user) => user.id === memberForm.userId);
    if (!stillAvailable) {
      setMemberForm((current) => ({ ...current, userId: availableUsers[0].id }));
    }
  }, [availableUsers, memberForm.userId]);

  async function refreshWorkspace(preferredTeamId?: string) {
    const res = await fetch('/api/workspace', { cache: 'no-store' });
    const snapshot = await res.json();

    if (!res.ok) {
      throw new Error(snapshot.error || 'Failed to refresh workspace');
    }

    startTransition(() => {
      setData(snapshot);
      setSelectedTeamId(preferredTeamId || snapshot.teams[0]?.id || '');
    });
  }

  async function submitJson(url: string, init: RequestInit, successMessage: string, preferredTeamId?: string) {
    const res = await fetch(url, init);
    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Request failed');
    }

    await refreshWorkspace(preferredTeamId);
    setFeedback({ type: 'success', text: successMessage });
    return result;
  }

  async function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey('create-team');

    try {
      const result = await submitJson(
        '/api/workspace',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createTeam',
            ...teamForm,
          }),
        },
        'Team created and a General channel is ready.',
      );

      setTeamForm({ name: '', description: '', icon: '' });
      setShowTeamForm(false);
      setShowChannelForm(true);
      setShowMemberForm(true);
      setSelectedTeamId(result.teamId);
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  async function handleCreateChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam) return;
    setBusyKey('create-channel');

    try {
      await submitJson(
        '/api/workspace',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createChannel',
            teamId: selectedTeam.id,
            ...channelForm,
          }),
        },
        `Channel created in ${selectedTeam.name}.`,
        selectedTeam.id,
      );

      setChannelForm({ name: '', description: '', kind: 'project' });
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam || !memberForm.userId) return;
    setBusyKey('add-member');

    try {
      const memberName = availableUsers.find((user) => user.id === memberForm.userId)?.display_name ?? 'Member';
      await submitJson(
        '/api/workspace',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'addMember',
            teamId: selectedTeam.id,
            userId: memberForm.userId,
            role: memberForm.role,
          }),
        },
        `${memberName} joined ${selectedTeam.name}.`,
        selectedTeam.id,
      );
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  async function handleRoleChange(team: WorkspaceTeam, userId: string, role: TeamRole) {
    setBusyKey(`role-${team.id}-${userId}`);

    try {
      await submitJson(
        '/api/workspace',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: team.id, userId, role }),
        },
        'Team permissions updated.',
        team.id,
      );
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  async function handleRemoveMember(team: WorkspaceTeam, userId: string, label: string) {
    if (!confirm(`Remove ${label} from ${team.name}?`)) return;
    setBusyKey(`remove-${team.id}-${userId}`);

    try {
      await submitJson(
        '/api/workspace',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: team.id, userId }),
        },
        `${label} was removed from ${team.name}.`,
        team.id,
      );
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  async function handleApproval(id: string, action: 'approve' | 'reject', name: string) {
    if (action === 'reject' && !confirm(`Reject ${name}'s request?`)) return;
    setBusyKey(`${action}-${id}`);

    try {
      await submitJson(
        '/api/team/approve',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action }),
        },
        action === 'approve' ? `${name} is now active.` : `${name} was removed from pending approvals.`,
        selectedTeam?.id,
      );
    } catch (error) {
      setFeedback({ type: 'error', text: (error as Error).message });
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className={styles.workspace}>
      {feedback && (
        <div className={`${styles.feedback} ${feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}>
          {feedback.text}
        </div>
      )}

      {isAdmin && data.pendingUsers.length > 0 && (
        <section className={`${styles.pendingPanel} glass`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Access Requests</p>
              <h3>Pending approvals</h3>
            </div>
            <span className={styles.counter}>{data.pendingUsers.length}</span>
          </div>

          <div className={styles.pendingList}>
            {data.pendingUsers.map((user) => (
              <div key={user.id} className={styles.pendingCard}>
                <div className={styles.pendingUser}>
                  <div className={styles.avatar}>{getInitials(user.display_name || user.username)}</div>
                  <div>
                    <div className={styles.pendingName}>{user.display_name || user.username}</div>
                    <div className={styles.pendingMeta}>
                      @{user.username}
                      {user.email ? ` · ${user.email}` : ''}
                    </div>
                  </div>
                </div>
                <div className={styles.pendingActions}>
                  <button
                    type="button"
                    className={styles.approveButton}
                    disabled={busyKey === `approve-${user.id}`}
                    onClick={() => handleApproval(user.id, 'approve', user.display_name || user.username)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={styles.rejectButton}
                    disabled={busyKey === `reject-${user.id}`}
                    onClick={() => handleApproval(user.id, 'reject', user.display_name || user.username)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.grid}>
        <section className={`${styles.panel} ${styles.teamsPanel} glass`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Workspace Map</p>
              <h3>Teams</h3>
            </div>
            <span className={styles.counter}>{data.teams.length}</span>
          </div>

          <p className={styles.panelText}>
            Create a team for each function or department, then split delivery work into dedicated project channels.
          </p>

          {isAdmin && (
            <button type="button" className={styles.primaryButton} onClick={() => setShowTeamForm((open) => !open)}>
              {showTeamForm ? 'Hide team form' : 'Create team'}
            </button>
          )}

          {showTeamForm && isAdmin && (
            <form className={styles.form} onSubmit={handleCreateTeam}>
              <label className={styles.field}>
                <span>Team name</span>
                <input
                  required
                  value={teamForm.name}
                  onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Product Ops"
                />
              </label>
              <label className={styles.field}>
                <span>Description</span>
                <textarea
                  rows={3}
                  value={teamForm.description}
                  onChange={(event) => setTeamForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Own roadmap delivery, launches, and cross-functional coordination."
                />
              </label>
              <label className={styles.field}>
                <span>Badge</span>
                <input
                  maxLength={2}
                  value={teamForm.icon}
                  onChange={(event) => setTeamForm((current) => ({ ...current, icon: event.target.value.toUpperCase() }))}
                  placeholder="PO"
                />
              </label>
              <button type="submit" className={styles.submitButton} disabled={busyKey === 'create-team'}>
                {busyKey === 'create-team' ? 'Creating...' : 'Create team'}
              </button>
            </form>
          )}

          <div className={styles.teamList}>
            {data.teams.length === 0 && (
              <div className={styles.emptyState}>
                <strong>No teams yet</strong>
                <p>Start with one top-level team, then add project channels and members under it.</p>
              </div>
            )}

            {data.teams.map((team) => (
              <button
                key={team.id}
                type="button"
                className={`${styles.teamCard} ${selectedTeamId === team.id ? styles.teamCardActive : ''}`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <div className={styles.teamCardTop}>
                  <div className={styles.teamIcon}>{team.icon}</div>
                  <div>
                    <div className={styles.teamName}>{team.name}</div>
                    <div className={styles.teamMeta}>{team.memberCount} members · {team.channelCount} channels</div>
                  </div>
                </div>
                <p className={styles.teamDescription}>{team.description || 'No team description yet.'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.channelsPanel} glass`}>
          {selectedTeam ? (
            <>
              <div className={styles.teamHero}>
                <div className={styles.teamHeroIcon}>{selectedTeam.icon}</div>
                <div>
                  <p className={styles.kicker}>Selected Team</p>
                  <h3>{selectedTeam.name}</h3>
                  <p className={styles.panelText}>{selectedTeam.description || 'This team is ready for project channels and collaboration.'}</p>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span>{selectedTeam.memberCount}</span>
                  <small>Members</small>
                </div>
                <div className={styles.heroStat}>
                  <span>{coreChannels.length}</span>
                  <small>Core Channels</small>
                </div>
                <div className={styles.heroStat}>
                  <span>{projectChannels.length}</span>
                  <small>Project Channels</small>
                </div>
              </div>

              {isAdmin && (
                <div className={styles.actionBar}>
                  <button type="button" className={styles.primaryButton} onClick={() => setShowChannelForm((open) => !open)}>
                    {showChannelForm ? 'Hide channel form' : 'Create channel'}
                  </button>
                </div>
              )}

              {showChannelForm && isAdmin && (
                <form className={styles.form} onSubmit={handleCreateChannel}>
                  <label className={styles.field}>
                    <span>Channel name</span>
                    <input
                      required
                      value={channelForm.name}
                      onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Sprint launch"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Purpose</span>
                    <textarea
                      rows={3}
                      value={channelForm.description}
                      onChange={(event) => setChannelForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Daily updates, blockers, notes, and delivery decisions."
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Channel type</span>
                    <select
                      value={channelForm.kind}
                      onChange={(event) =>
                        setChannelForm((current) => ({ ...current, kind: event.target.value as ChannelKind }))
                      }
                    >
                      {CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className={styles.formHint}>
                    {CHANNEL_OPTIONS.find((option) => option.value === channelForm.kind)?.hint}
                  </p>
                  <button type="submit" className={styles.submitButton} disabled={busyKey === 'create-channel'}>
                    {busyKey === 'create-channel' ? 'Creating...' : 'Add channel'}
                  </button>
                </form>
              )}

              <div className={styles.channelSection}>
                <div className={styles.sectionHeader}>
                  <h4>Core channels</h4>
                  <span>{coreChannels.length}</span>
                </div>
                <div className={styles.channelList}>
                  {coreChannels.map((channel) => (
                    <article key={channel.id} className={styles.channelCard}>
                      <div className={styles.channelHeader}>
                        <div>
                          <div className={styles.channelTitle}># {channel.name}</div>
                          <div className={`${styles.channelBadge} ${getChannelTone(channel.kind)}`}>
                            {channel.isDefault ? 'Default' : channel.kind}
                          </div>
                        </div>
                        <span className={styles.channelAudience}>All {selectedTeam.memberCount} members</span>
                      </div>
                      <p className={styles.channelDescription}>
                        {channel.description || 'This channel is ready for shared conversations and quick coordination.'}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.channelSection}>
                <div className={styles.sectionHeader}>
                  <h4>Project channels</h4>
                  <span>{projectChannels.length}</span>
                </div>
                <div className={styles.channelList}>
                  {projectChannels.length === 0 && (
                    <div className={styles.emptyInline}>
                      Add your first project channel for a launch, sprint, client workstream, or department initiative.
                    </div>
                  )}
                  {projectChannels.map((channel) => (
                    <article key={channel.id} className={styles.channelCard}>
                      <div className={styles.channelHeader}>
                        <div>
                          <div className={styles.channelTitle}># {channel.name}</div>
                          <div className={`${styles.channelBadge} ${getChannelTone(channel.kind)}`}>Project</div>
                        </div>
                        <span className={styles.channelAudience}>Visible to the full team</span>
                      </div>
                      <p className={styles.channelDescription}>
                        {channel.description || 'Use this project channel for delivery updates, docs, and decisions.'}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyStateTall}>
              <strong>Select or create a team</strong>
              <p>The workspace board will show channels, project spaces, and member assignments here.</p>
            </div>
          )}
        </section>

        <section className={`${styles.panel} ${styles.membersPanel} glass`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>People</p>
              <h3>{selectedTeam ? `${selectedTeam.name} members` : 'Team members'}</h3>
            </div>
            <span className={styles.counter}>{selectedTeam?.memberCount ?? 0}</span>
          </div>

          <p className={styles.panelText}>
            Bring active users and AI agents into the team, then assign owner, admin, or member permissions.
          </p>

          {isAdmin && selectedTeam && (
            <>
              <button type="button" className={styles.primaryButton} onClick={() => setShowMemberForm((open) => !open)}>
                {showMemberForm ? 'Hide member form' : 'Add member'}
              </button>

              {showMemberForm && (
                <form className={styles.form} onSubmit={handleAddMember}>
                  <label className={styles.field}>
                    <span>User</span>
                    <select
                      value={memberForm.userId}
                      onChange={(event) => setMemberForm((current) => ({ ...current, userId: event.target.value }))}
                      disabled={availableUsers.length === 0}
                    >
                      {availableUsers.length === 0 && <option value="">All active users are already in this team</option>}
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.display_name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Team role</span>
                    <select
                      value={memberForm.role}
                      onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value as TeamRole }))}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={busyKey === 'add-member' || availableUsers.length === 0 || !memberForm.userId}
                  >
                    {busyKey === 'add-member' ? 'Adding...' : 'Add to team'}
                  </button>
                </form>
              )}
            </>
          )}

          {selectedTeam ? (
            <div className={styles.memberList}>
              {selectedTeam.members.map((member) => {
                const person = member.user;
                const label = person?.display_name || 'Unknown member';
                const isSelf = member.userId === currentUserId;
                const busy = busyKey === `role-${selectedTeam.id}-${member.userId}` || busyKey === `remove-${selectedTeam.id}-${member.userId}`;

                return (
                  <article key={member.id} className={styles.memberCard}>
                    <div className={styles.memberIdentity}>
                      <div className={styles.avatar}>{getInitials(label)}</div>
                      <div>
                        <div className={styles.memberName}>
                          {label}
                          {isSelf && <span className={styles.youBadge}>You</span>}
                        </div>
                        <div className={styles.memberMeta}>
                          @{person?.username || 'unknown'}
                          {person?.email ? ` · ${person.email}` : ''}
                        </div>
                        <div className={styles.memberBadges}>
                          <span className={`${styles.roleChip} ${getRoleTone(member.role)}`}>{member.role}</span>
                          {person?.role && <span className={`${styles.roleChip} ${getRoleTone(person.role)}`}>{person.role}</span>}
                        </div>
                      </div>
                    </div>

                    {isAdmin ? (
                      <div className={styles.memberControls}>
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            handleRoleChange(selectedTeam, member.userId, event.target.value as TeamRole)
                          }
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.removeButton}
                          disabled={busy}
                          onClick={() => handleRemoveMember(selectedTeam, member.userId, label)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className={styles.readOnlyRole}>{member.role}</div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No team selected</strong>
              <p>Pick a team to review its members and roles.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
