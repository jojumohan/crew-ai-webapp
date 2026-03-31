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

type SeedContact = {
  id: string;
  displayName: string;
  username: string;
  phoneLabel: string;
  about: string;
  lastSeenMinutesAgo: number;
};

type SeedConversation = {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  memberIds: string[];
  messages: Array<{
    senderId: string;
    senderName: string;
    body: string;
    minutesAgo: number;
  }>;
};

const minute = 60 * 1000;
const accentPalette = ['#4ed0a8', '#f8b35d', '#8db8ff', '#f28b82', '#b7a1ff'];
const collections = {
  profiles: 'messaging_profiles',
  conversations: 'messaging_conversations',
} as const;

const seedContacts: SeedContact[] = [
  {
    id: 'contact-sara',
    displayName: 'Sara Khan',
    username: 'sara.khan',
    phoneLabel: '+91 90000 10001',
    about: 'Product designer for the rebuild.',
    lastSeenMinutesAgo: 2,
  },
  {
    id: 'contact-milan',
    displayName: 'Milan Patel',
    username: 'milan.patel',
    phoneLabel: '+91 90000 10002',
    about: 'Backend engineer focused on data modeling.',
    lastSeenMinutesAgo: 18,
  },
  {
    id: 'contact-nina',
    displayName: 'Nina Roy',
    username: 'nina.roy',
    phoneLabel: '+91 90000 10003',
    about: 'Program lead for launch readiness.',
    lastSeenMinutesAgo: 9,
  },
  {
    id: 'contact-omar',
    displayName: 'Omar Lee',
    username: 'omar.lee',
    phoneLabel: '+91 90000 10004',
    about: 'Infra engineer handling delivery and queue design.',
    lastSeenMinutesAgo: 7,
  },
  {
    id: 'contact-ops',
    displayName: 'Ops Bot',
    username: 'ops.bot',
    phoneLabel: '+91 bot bridge',
    about: 'Operations status assistant.',
    lastSeenMinutesAgo: 4,
  },
];

function makeViewer(viewerSession?: ViewerSession) {
  return getMockMessagingSnapshot(viewerSession).viewer;
}

function buildSeedConversations(viewerId: string, viewerName: string): SeedConversation[] {
  return [
    {
      id: `seed_${viewerId}_direct_sara`,
      type: 'direct',
      title: null,
      memberIds: [viewerId, 'contact-sara'],
      messages: [
        {
          senderId: 'contact-sara',
          senderName: 'Sara Khan',
          body: 'I reviewed the brief. We should keep the web app fast and chat-first.',
          minutesAgo: 22,
        },
        {
          senderId: viewerId,
          senderName: viewerName,
          body: 'Agreed. Phase 1 is auth, 1-on-1 chat, uploads, and presence.',
          minutesAgo: 18,
        },
        {
          senderId: 'contact-sara',
          senderName: 'Sara Khan',
          body: 'I can prepare the UI states for unread, typing, and call entry.',
          minutesAgo: 11,
        },
        {
          senderId: viewerId,
          senderName: viewerName,
          body: 'Perfect. I am replacing the dashboard shell with a messaging workspace now.',
          minutesAgo: 4,
        },
      ],
    },
    {
      id: `seed_${viewerId}_group_launch`,
      type: 'group',
      title: 'Launch Core',
      memberIds: [viewerId, 'contact-sara', 'contact-nina', 'contact-omar', 'contact-milan'],
      messages: [
        {
          senderId: 'contact-nina',
          senderName: 'Nina Roy',
          body: 'Roadmap is aligned: MVP, group features, then calls.',
          minutesAgo: 59,
        },
        {
          senderId: viewerId,
          senderName: viewerName,
          body: 'I am keeping env and deployment config, but the product surface is being rebuilt.',
          minutesAgo: 45,
        },
        {
          senderId: 'contact-omar',
          senderName: 'Omar Lee',
          body: 'We should add Redis before presence so the contracts stay stable.',
          minutesAgo: 17,
        },
      ],
    },
    {
      id: `seed_${viewerId}_direct_milan`,
      type: 'direct',
      title: null,
      memberIds: [viewerId, 'contact-milan'],
      messages: [
        {
          senderId: 'contact-milan',
          senderName: 'Milan Patel',
          body: 'For message history, cursor pagination is the right move.',
          minutesAgo: 95,
        },
        {
          senderId: viewerId,
          senderName: viewerName,
          body: 'Yes. I am pairing that with Firebase summaries for the chat list.',
          minutesAgo: 91,
        },
      ],
    },
    {
      id: `seed_${viewerId}_group_ops`,
      type: 'group',
      title: 'Ops Bridge',
      memberIds: [viewerId, 'contact-ops', 'contact-omar', 'contact-nina'],
      messages: [
        {
          senderId: 'contact-ops',
          senderName: 'Ops Bot',
          body: 'Daily status: storage and notifications remain on the Phase 3 track.',
          minutesAgo: 73,
        },
        {
          senderId: viewerId,
          senderName: viewerName,
          body: 'Noted. We will keep uploads signed and move heavy work into workers.',
          minutesAgo: 67,
        },
      ],
    },
  ];
}

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
    return 'Offline';
  }

  return `Last seen ${formatRelative(lastSeenAt)} ago`;
}

async function ensureStarterData(viewerSession?: ViewerSession): Promise<void> {
  const viewer = makeViewer(viewerSession);

  await adminDb.collection(collections.profiles).doc(viewer.id).set(
    {
      displayName: viewer.displayName,
      username: slugify(viewer.displayName),
      phoneLabel: viewer.phoneLabel,
      about: viewer.about,
      avatarLabel: viewer.avatarLabel,
      lastSeenAt: new Date(),
    } satisfies FirestoreProfile,
    { merge: true }
  );

  const existingConversations = await adminDb
    .collection(collections.conversations)
    .where('participantIds', 'array-contains', viewer.id)
    .limit(1)
    .get();

  if (!existingConversations.empty) {
    return;
  }

  const batch = adminDb.batch();

  for (const contact of seedContacts) {
    batch.set(
      adminDb.collection(collections.profiles).doc(contact.id),
      {
        displayName: contact.displayName,
        username: contact.username,
        phoneLabel: contact.phoneLabel,
        about: contact.about,
        avatarLabel: deriveAvatarLabel(contact.displayName),
        lastSeenAt: new Date(Date.now() - contact.lastSeenMinutesAgo * minute),
      } satisfies FirestoreProfile,
      { merge: true }
    );
  }

  const conversations = buildSeedConversations(viewer.id, viewer.displayName);

  for (const conversation of conversations) {
    const conversationRef = adminDb.collection(collections.conversations).doc(conversation.id);
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const lastMessageAt = new Date(Date.now() - lastMessage.minutesAgo * minute);

    batch.set(conversationRef, {
      type: conversation.type,
      title: conversation.title,
      participantIds: conversation.memberIds,
      memberCount: conversation.memberIds.length,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt,
      lastMessageText: lastMessage.body,
      lastMessageSenderId: lastMessage.senderId,
      lastMessageSenderName: lastMessage.senderName,
    } satisfies FirestoreConversation);

    conversation.messages.forEach((message, index) => {
      batch.set(conversationRef.collection('messages').doc(`seed-${index}`), {
        clientId: `seed.${conversation.id}.${index}`,
        senderId: message.senderId,
        senderName: message.senderName,
        body: message.body,
        kind: 'text',
        createdAt: new Date(Date.now() - message.minutesAgo * minute),
      } satisfies FirestoreMessage);
    });
  }

  await batch.commit();
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

async function getFirestoreSnapshot(viewerSession?: ViewerSession): Promise<MessagingSnapshot> {
  const viewer = makeViewer(viewerSession);

  await ensureStarterData(viewerSession);

  const conversationSnapshot = await adminDb
    .collection(collections.conversations)
    .where('participantIds', 'array-contains', viewer.id)
    .get();

  if (conversationSnapshot.empty) {
    return getMockMessagingSnapshot(viewerSession);
  }

  const conversationDocs = conversationSnapshot.docs
    .map((document) => ({
      id: document.id,
      ...((document.data() as FirestoreConversation) || {}),
    }))
    .sort((left, right) => {
      const leftIso = toIso(left.lastMessageAt || left.createdAt) || '';
      const rightIso = toIso(right.lastMessageAt || right.createdAt) || '';
      return rightIso.localeCompare(leftIso);
    });

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
    const otherProfile = participantIds
      .filter((participantId) => participantId !== viewer.id)
      .map((participantId) => profiles[participantId])
      .find(Boolean);
    const title =
      conversation.type === 'direct'
        ? otherProfile?.displayName || conversation.title || 'Direct chat'
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
      lastActivityLabel: latestMessage ? formatRelative(latestMessage.createdAt) : 'now',
      presence: conversation.type === 'direct' ? getPresenceState(otherLastSeen) : 'online',
    } satisfies ConversationSummary;
  });

  return {
    viewer,
    conversations,
    messagesByConversation,
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

export async function createMessage(
  input: SendMessageInput,
  viewerSession?: ViewerSession
): Promise<{ message: MessagingMessage; conversations: ConversationSummary[] } | null> {
  const viewer = makeViewer(viewerSession);
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    return null;
  }

  try {
    await ensureStarterData(viewerSession);

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
        {
          displayName: viewer.displayName,
          username: slugify(viewer.displayName),
          phoneLabel: viewer.phoneLabel,
          about: viewer.about,
          avatarLabel: viewer.avatarLabel,
          lastSeenAt: createdAt,
        } satisfies FirestoreProfile,
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
    console.error('[messaging-store] message fallback:', error);
    return appendMockMessage(input, viewerSession);
  }
}
