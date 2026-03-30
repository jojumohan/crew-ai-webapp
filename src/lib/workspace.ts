import { db } from '@/lib/firebase-admin';

export type TeamRole = 'owner' | 'admin' | 'member';
export type ChannelKind = 'general' | 'project' | 'announcements' | 'support';

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type RawWorkspaceUser = {
  username?: string;
  display_name?: string;
  email?: string | null;
  role?: 'admin' | 'staff' | 'agent';
  status?: 'active' | 'pending';
  created_at?: unknown;
};

type RawWorkspaceMember = {
  teamId?: string;
  userId?: string;
  role?: TeamRole;
  joinedAt?: unknown;
  addedBy?: string;
};

type RawWorkspaceChannel = {
  teamId?: string;
  name?: string;
  slug?: string;
  description?: string;
  kind?: ChannelKind;
  isDefault?: boolean;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type WorkspaceUser = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: 'admin' | 'staff' | 'agent';
  status: 'active' | 'pending';
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  addedBy: string;
  user: WorkspaceUser | null;
};

export type WorkspaceChannel = {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description: string;
  kind: ChannelKind;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceTeam = {
  id: string;
  name: string;
  description: string;
  icon: string;
  visibility: 'private' | 'org';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  channels: WorkspaceChannel[];
  members: WorkspaceMember[];
  memberCount: number;
  channelCount: number;
};

export type WorkspaceSnapshot = {
  users: WorkspaceUser[];
  pendingUsers: WorkspaceUser[];
  teams: WorkspaceTeam[];
};

export function normalizeChannelSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function toIsoString(value: unknown) {
  if (!value) return new Date(0).toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();

  const maybeTimestamp = value as FirestoreTimestampLike;
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate().toISOString();
  }

  return new Date(0).toISOString();
}

function sanitizeUser(id: string, raw: RawWorkspaceUser): WorkspaceUser {
  return {
    id,
    username: raw.username ?? '',
    display_name: raw.display_name ?? raw.username ?? 'Unknown user',
    email: raw.email ?? null,
    role: raw.role ?? 'staff',
    status: raw.status ?? 'active',
    created_at: toIsoString(raw.created_at),
  };
}

function sanitizeMembership(id: string, raw: RawWorkspaceMember, user: WorkspaceUser | null): WorkspaceMember {
  return {
    id,
    teamId: raw.teamId ?? '',
    userId: raw.userId ?? '',
    role: raw.role ?? 'member',
    joinedAt: toIsoString(raw.joinedAt),
    addedBy: raw.addedBy ?? '',
    user,
  };
}

function sanitizeChannel(id: string, raw: RawWorkspaceChannel): WorkspaceChannel {
  return {
    id,
    teamId: raw.teamId ?? '',
    name: raw.name ?? 'Untitled channel',
    slug: raw.slug ?? normalizeChannelSlug(raw.name ?? 'channel'),
    description: raw.description ?? '',
    kind: raw.kind ?? 'project',
    isDefault: Boolean(raw.isDefault),
    createdBy: raw.createdBy ?? '',
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  };
}

function sortMembers(a: WorkspaceMember, b: WorkspaceMember) {
  const rank: Record<TeamRole, number> = {
    owner: 0,
    admin: 1,
    member: 2,
  };

  if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
  return (a.user?.display_name ?? '').localeCompare(b.user?.display_name ?? '');
}

function sortChannels(a: WorkspaceChannel, b: WorkspaceChannel) {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  return a.name.localeCompare(b.name);
}

function sortTeams(a: WorkspaceTeam, b: WorkspaceTeam) {
  return a.name.localeCompare(b.name);
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [usersSnap, teamsSnap, channelsSnap, membersSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('teams').get(),
    db.collection('channels').get(),
    db.collection('teamMembers').get(),
  ]);

  const users = usersSnap.docs.map((doc) => sanitizeUser(doc.id, doc.data()));
  const activeUsers = users
    .filter((user) => user.status === 'active')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const pendingUsers = users
    .filter((user) => user.status === 'pending')
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const userMap = new Map(activeUsers.map((user) => [user.id, user]));

  const channels = channelsSnap.docs.map((doc) => sanitizeChannel(doc.id, doc.data()));
  const teamMembers = membersSnap.docs.map((doc) =>
    sanitizeMembership(doc.id, doc.data(), userMap.get(doc.data().userId) ?? null)
  );

  const teams = teamsSnap.docs
    .map((doc) => {
      const team = doc.data();
      const members = teamMembers
        .filter((member) => member.teamId === doc.id)
        .sort(sortMembers);
      const teamChannels = channels
        .filter((channel) => channel.teamId === doc.id)
        .sort(sortChannels);

      return {
        id: doc.id,
        name: team.name ?? 'Untitled team',
        description: team.description ?? '',
        icon: team.icon ?? (team.name?.[0] ?? 'T'),
        visibility: team.visibility ?? 'private',
        createdBy: team.createdBy ?? '',
        createdAt: toIsoString(team.createdAt),
        updatedAt: toIsoString(team.updatedAt),
        members,
        channels: teamChannels,
        memberCount: members.length,
        channelCount: teamChannels.length,
      } satisfies WorkspaceTeam;
    })
    .sort(sortTeams);

  return {
    users: activeUsers,
    pendingUsers,
    teams,
  };
}
