import { db as adminDb } from '@/lib/firebase-admin';
import {
  appendMessage as appendMockMessage,
  getConversationMessages as getMockConversationMessages,
  getMessagingSnapshot as getMockMessagingSnapshot,
} from './mock-store';
import type {
  ConversationSummary,
  MessagingMessage,
  MessagingSnapshot,
  PresenceState,
  SendMessageInput,
  ViewerSession,
  WorkspaceMember,
} from './types';

type Timestampish = Date | string | null | undefined | { toDate(): Date };

type FirestoreProfile = {
  displayName: string;
  username: string;
  phoneLabel: string;
  about: string;
  avatarLabel: string;
  lastSeenAt?: Timestampish;
};

type FirestoreConversation = {
  type: 'direct' | 'group';
  title?: string | null;
  participantIds: string[];
  memberCount: number;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
  lastMessageAt?: Timestampish;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
};

type FirestoreMessage = {
  clientId: string;
  senderId: string;
  senderName: string;
  body: string;
  kind: 'text';
  createdAt?: Timestampish;
};

type FirestoreUser = {
  username?: string;
  display_name?: string;
  email?: string | null;
  role?: string;
  status?: 'active' | 'pending' | string;
  created_at?: Timestampish;
};

type TeamDirectory = {
  activeMembers: WorkspaceMember[];
  pendingMembers: WorkspaceMember[];
  memberById: Record<string, WorkspaceMember>;
  userById: Record<string, FirestoreUser>;
};

const minute = 60 * 1000;
const accentPalette = ['#4ed0a8', '#f8b35d', '#8db8ff', '#f28b82', '#b7a1ff'];
const collections = {
  profiles: 'messaging_profiles',
  conversations: 'messaging_conversations',
} as const;
const legacySeedProfileIds = ['contact-sara', 'contact-milan', 'contact-nina', 'contact-omar', 'contact-ops'];

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'user'
  );
}

function hasToDate(value: unknown): value is { toDate(): Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  );
}

function toIso(value: Timestampish): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (hasToDate(value)) {
    return value.toDate().toISOString();
  }

  return null;
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatRelative(iso: string): string {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / minute));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d`;
}

function formatCreatedAtLabel(iso: string | null): string {
  if (!iso) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function deriveAvatarLabel(title: string): string {
  const words = title
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'C';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getAccent(key: string): string {
  let hash = 0;

  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) % accentPalette.length;
  }

  return accentPalette[Math.abs(hash) % accentPalette.length];
}

function getPresenceState(lastSeenAt: string | null): PresenceState {
  if (!lastSeenAt) {
    return 'offline';
  }

  const diffMinutes = Math.round((Date.now() - new Date(lastSeenAt).getTime()) / minute);

  if (diffMinutes <= 5) {
    return 'online';
  }

  if (diffMinutes <= 45) {
    return 'away';
  }

  return 'offline';
}

function getDirectSubtitle(lastSeenAt: string | null): string {
  const presence = getPresenceState(lastSeenAt);

  if (presence === 'online') {
    return 'Online now';
  }

  if (!lastSeenAt) {
    return 'Waiting for activity';
  }

  return `Last seen ${formatRelative(lastSeenAt)} ago`;
}

function buildViewer(viewerSession?: ViewerSession, currentUser?: FirestoreUser): MessagingSnapshot['viewer'] {
  const displayName =
    currentUser?.display_name?.trim() ||
    viewerSession?.name?.trim() ||
    currentUser?.username?.trim() ||
    'Workspace User';
  const username = currentUser?.username?.trim() || slugify(displayName);
  const role = currentUser?.role || viewerSession?.role || 'staff';
  const email = currentUser?.email || viewerSession?.email || null;

  return {
    id: viewerSession?.id || 'viewer-session',
    displayName,
    handle: `@${username}`,
    avatarLabel: deriveAvatarLabel(displayName),
    phoneLabel: email || 'Connected account',
    about: role === 'admin' ? 'Admin account connected.' : 'Connected team member.',
    email,
    role,
  };
}

function toWorkspaceMember(id: string, user: FirestoreUser): WorkspaceMember {
  const displayName = user.display_name?.trim() || user.username?.trim() || 'Team member';
  const status = user.status === 'pending' ? 'pending' : 'active';

  return {
    id,
    username: user.username?.trim() || slugify(displayName),
    displayName,
    email: user.email || null,
    role: user.role || 'staff',
    status,
    avatarLabel: deriveAvatarLabel(displayName),
    createdAtLabel: formatCreatedAtLabel(toIso(user.created_at)),
  };
}

function toProfilePayload(member: WorkspaceMember | MessagingSnapshot['viewer'], lastSeenAt?: Date): FirestoreProfile {
  const username = 'handle' in member ? member.handle.slice(1) : member.username;

  return {
    displayName: member.displayName,
    username,
    phoneLabel: member.email || 'Connected account',
    about: member.role === 'admin' ? 'Admin account connected.' : 'Connected team member.',
    avatarLabel: member.avatarLabel,
    ...(lastSeenAt ? { lastSeenAt } : {}),
  };
}

function isLegacySeedConversation(conversationId: string): boolean {
  return conversationId.startsWith('seed_');
}

async function deleteConversation(conversationId: string): Promise<void> {
  const conversationRef = adminDb.collection(collections.conversations).doc(conversationId);
  const messageSnapshot = await conversationRef.collection('messages').get();

  if (!messageSnapshot.empty) {
    const batch = adminDb.batch();

    for (const document of messageSnapshot.docs) {
      batch.delete(document.ref);
    }

    await batch.commit();
  }

  await conversationRef.delete();
}

async function cleanupLegacySeedData(viewerId: string): Promise<void> {
  const snapshot = await adminDb
    .collection(collections.conversations)
    .where('participantIds', 'array-contains', viewerId)
    .get();

  const seedConversationIds = snapshot.docs
    .map((document) => document.id)
    .filter((conversationId) => isLegacySeedConversation(conversationId));

  await Promise.all(seedConversationIds.map((conversationId) => deleteConversation(conversationId)));
  await Promise.all(
    legacySeedProfileIds.map((profileId) => adminDb.collection(collections.profiles).doc(profileId).delete())
  );
}

async function loadProfiles(profileIds: string[]): Promise<Record<string, FirestoreProfile>> {
  if (profileIds.length === 0) {
    return {};
  }

  const refs = profileIds.map((profileId) => adminDb.collection(collections.profiles).doc(profileId));
  const snapshots = await adminDb.getAll(...refs);

  return snapshots.reduce<Record<string, FirestoreProfile>>((accumulator, snapshot) => {
    if (snapshot.exists) {
      accumulator[snapshot.id] = snapshot.data() as FirestoreProfile;
    }
    return accumulator;
  }, {});
}

async function loadConversationMessageDocs(conversationId: string): Promise<MessagingMessage[]> {
  const snapshot = await adminDb
    .collection(collections.conversations)
    .doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data() as FirestoreMessage;
    const createdAt = toIso(data.createdAt) || new Date().toISOString();

    return {
      id: document.id,
      clientId: data.clientId,
      conversationId,
      senderId: data.senderId,
      senderName: data.senderName,
      body: data.body,
      kind: 'text',
      createdAt,
      createdAtLabel: formatClock(createdAt),
      delivery: 'read',
      direction: 'incoming',
    } satisfies MessagingMessage;
  });
}

async function loadTeamDirectory(): Promise<TeamDirectory> {
  const snapshot = await adminDb.collection('users').orderBy('created_at', 'asc').get();

  const members = snapshot.docs.map((document) =>
    toWorkspaceMember(document.id, document.data() as FirestoreUser)
  );
  const activeMembers = members.filter((member) => member.status === 'active');
  const pendingMembers = members.filter((member) => member.status === 'pending');

  return {
    activeMembers,
    pendingMembers,
    memberById: members.reduce<Record<string, WorkspaceMember>>((accumulator, member) => {
      accumulator[member.id] = member;
      return accumulator;
    }, {}),
    userById: snapshot.docs.reduce<Record<string, FirestoreUser>>((accumulator, document) => {
      accumulator[document.id] = document.data() as FirestoreUser;
      return accumulator;
    }, {}),
  };
}

async function buildViewerContext(viewerSession?: ViewerSession): Promise<{
  viewer: MessagingSnapshot['viewer'];
  teamDirectory: TeamDirectory;
}> {
  const teamDirectory = await loadTeamDirectory();
  const currentUser = viewerSession?.id ? teamDirectory.userById[viewerSession.id] : undefined;
  const viewer = buildViewer(viewerSession, currentUser);

  await adminDb
    .collection(collections.profiles)
    .doc(viewer.id)
    .set(toProfilePayload(viewer, new Date()), { merge: true });

  return { viewer, teamDirectory };
}

function buildDirectConversationId(viewerId: string, memberId: string): string {
  const [left, right] = [viewerId, memberId]
    .sort((first, second) => first.localeCompare(second))
    .map((value) => Buffer.from(value).toString('base64url'));

  return `direct_${left}_${right}`;
}

async function getFirestoreSnapshot(viewerSession?: ViewerSession): Promise<MessagingSnapshot> {
  const { viewer, teamDirectory } = await buildViewerContext(viewerSession);
  const memberById = teamDirectory.memberById;

  try {
    await cleanupLegacySeedData(viewer.id);
  } catch (error) {
    console.warn('[messaging-store] legacy cleanup skipped:', error);
  }

  const conversationSnapshot = await adminDb
    .collection(collections.conversations)
    .where('participantIds', 'array-contains', viewer.id)
    .get();

  const conversationDocs = conversationSnapshot.docs
    .filter((document) => !isLegacySeedConversation(document.id))
    .map((document) => ({
      id: document.id,
      ...((document.data() as FirestoreConversation) || {}),
    }))
    .sort((left, right) => {
      const leftIso = toIso(left.lastMessageAt || left.createdAt) || '';
      const rightIso = toIso(right.lastMessageAt || right.createdAt) || '';
      return rightIso.localeCompare(leftIso);
    });

  if (conversationDocs.length === 0) {
    return {
      viewer,
      conversations: [],
      messagesByConversation: {},
      members: teamDirectory.activeMembers,
      pendingMembers: teamDirectory.pendingMembers,
    };
  }

  const profileIds = [...new Set(conversationDocs.flatMap((conversation) => conversation.participantIds || []))];
  const profiles = await loadProfiles(profileIds);

  const messagesByConversationEntries = await Promise.all(
    conversationDocs.map(async (conversation) => {
      const messages = await loadConversationMessageDocs(conversation.id);

      return [
        conversation.id,
        messages.map(
          (message) =>
            ({
              ...message,
              direction: message.senderId === viewer.id ? 'outgoing' : 'incoming',
              delivery: message.senderId === viewer.id ? 'delivered' : 'read',
            }) satisfies MessagingMessage
        ),
      ] as const;
    })
  );

  const messagesByConversation = messagesByConversationEntries.reduce<Record<string, MessagingMessage[]>>(
    (accumulator, [conversationId, messages]) => {
      accumulator[conversationId] = messages;
      return accumulator;
    },
    {}
  );

  const conversations = conversationDocs.map((conversation) => {
    const participantIds = conversation.participantIds || [];
    const otherMemberId = participantIds.find((participantId) => participantId !== viewer.id);
    const otherProfile = otherMemberId ? profiles[otherMemberId] : undefined;
    const otherMember = otherMemberId ? memberById[otherMemberId] : undefined;
    const title =
      conversation.type === 'direct'
        ? otherProfile?.displayName || otherMember?.displayName || conversation.title || 'Direct chat'
        : conversation.title || 'Group chat';
    const otherLastSeen = toIso(otherProfile?.lastSeenAt);
    const latestMessage = messagesByConversation[conversation.id]?.slice(-1)[0];

    return {
      id: conversation.id,
      type: conversation.type,
      title,
      subtitle:
        conversation.type === 'direct'
          ? getDirectSubtitle(otherLastSeen)
          : `${conversation.memberCount} members`,
      avatarLabel: deriveAvatarLabel(title),
      accent: getAccent(conversation.id),
      unreadCount: 0,
      memberCount: conversation.memberCount,
      lastMessagePreview: latestMessage
        ? latestMessage.direction === 'outgoing'
          ? `You: ${latestMessage.body}`
          : `${latestMessage.senderName}: ${latestMessage.body}`
        : conversation.lastMessageText || 'No messages yet',
      lastActivityLabel: latestMessage
        ? formatRelative(latestMessage.createdAt)
        : formatRelative(toIso(conversation.createdAt) || new Date().toISOString()),
      presence: conversation.type === 'direct' ? getPresenceState(otherLastSeen) : 'online',
    } satisfies ConversationSummary;
  });

  return {
    viewer,
    conversations,
    messagesByConversation,
    members: teamDirectory.activeMembers,
    pendingMembers: teamDirectory.pendingMembers,
  };
}

export async function loadMessagingSnapshot(viewerSession?: ViewerSession): Promise<MessagingSnapshot> {
  try {
    return await getFirestoreSnapshot(viewerSession);
  } catch (error) {
    console.error('[messaging-store] snapshot fallback:', error);
    return getMockMessagingSnapshot(viewerSession);
  }
}

export async function loadConversationMessages(
  conversationId: string,
  viewerSession?: ViewerSession
): Promise<MessagingMessage[] | null> {
  try {
    const snapshot = await getFirestoreSnapshot(viewerSession);
    return snapshot.messagesByConversation[conversationId] || null;
  } catch (error) {
    console.error('[messaging-store] messages fallback:', error);
    return getMockConversationMessages(conversationId, viewerSession);
  }
}

export async function createDirectConversation(
  memberId: string,
  viewerSession?: ViewerSession
): Promise<{ conversationId: string; snapshot: MessagingSnapshot } | null> {
  if (!memberId || !viewerSession?.id) {
    return null;
  }

  try {
    const { viewer, teamDirectory } = await buildViewerContext(viewerSession);
    const member = teamDirectory.memberById[memberId];

    if (!member || member.status !== 'active' || member.id === viewer.id) {
      return null;
    }

    const conversationId = buildDirectConversationId(viewer.id, member.id);
    const conversationRef = adminDb.collection(collections.conversations).doc(conversationId);
    const existingConversation = await conversationRef.get();
    const participantIds = [viewer.id, member.id];

    if (!existingConversation.exists) {
      const createdAt = new Date();

      await Promise.all([
        adminDb.collection(collections.profiles).doc(member.id).set(toProfilePayload(member), { merge: true }),
        conversationRef.set({
          type: 'direct',
          title: null,
          participantIds,
          memberCount: participantIds.length,
          createdAt,
          updatedAt: createdAt,
        } satisfies FirestoreConversation),
      ]);
    }

    const snapshot = await getFirestoreSnapshot(viewerSession);

    return {
      conversationId,
      snapshot,
    };
  } catch (error) {
    console.error('[messaging-store] conversation create failed:', error);
    return null;
  }
}

export async function createMessage(
  input: SendMessageInput,
  viewerSession?: ViewerSession
): Promise<{ message: MessagingMessage; conversations: ConversationSummary[] } | null> {
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    return null;
  }

  try {
    const { viewer } = await buildViewerContext(viewerSession);
    const conversationRef = adminDb.collection(collections.conversations).doc(input.conversationId);
    const messageRef = conversationRef.collection('messages').doc();
    const createdAt = new Date();

    await adminDb.runTransaction(async (transaction) => {
      const conversationSnapshot = await transaction.get(conversationRef);

      if (!conversationSnapshot.exists) {
        throw new Error('conversation_not_found');
      }

      const conversation = conversationSnapshot.data() as FirestoreConversation;
      if (!(conversation.participantIds || []).includes(viewer.id)) {
        throw new Error('conversation_forbidden');
      }

      transaction.set(messageRef, {
        clientId: `live.${messageRef.id}`,
        senderId: viewer.id,
        senderName: viewer.displayName,
        body: trimmedBody,
        kind: 'text',
        createdAt,
      } satisfies FirestoreMessage);

      transaction.set(
        conversationRef,
        {
          updatedAt: createdAt,
          lastMessageAt: createdAt,
          lastMessageText: trimmedBody,
          lastMessageSenderId: viewer.id,
          lastMessageSenderName: viewer.displayName,
        } satisfies Partial<FirestoreConversation>,
        { merge: true }
      );

      transaction.set(
        adminDb.collection(collections.profiles).doc(viewer.id),
        toProfilePayload(viewer, createdAt),
        { merge: true }
      );
    });

    const snapshot = await getFirestoreSnapshot(viewerSession);

    return {
      message: {
        id: messageRef.id,
        clientId: `live.${messageRef.id}`,
        conversationId: input.conversationId,
        senderId: viewer.id,
        senderName: viewer.displayName,
        body: trimmedBody,
        kind: 'text',
        createdAt: createdAt.toISOString(),
        createdAtLabel: formatClock(createdAt.toISOString()),
        delivery: 'delivered',
        direction: 'outgoing',
      },
      conversations: snapshot.conversations,
    };
  } catch (error) {
    if (error instanceof Error && ['conversation_not_found', 'conversation_forbidden'].includes(error.message)) {
      return null;
    }

    console.error('[messaging-store] message fallback:', error);
    return appendMockMessage(input, viewerSession);
  }
}
