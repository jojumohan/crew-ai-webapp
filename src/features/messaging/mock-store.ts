import type {
  ConversationSummary,
  MessageDeliveryState,
  MessagingMessage,
  MessagingSnapshot,
  MessagingViewer,
  PresenceState,
  SendMessageInput,
  ViewerSession,
} from './types';

type StoredMessage = {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  kind: 'text';
  createdAt: string;
  delivery: MessageDeliveryState;
};

type StoredConversation = {
  id: string;
  type: 'direct' | 'group';
  title: string;
  subtitle: string;
  avatarLabel: string;
  accent: string;
  unreadCount: number;
  memberCount: number;
  presence: PresenceState;
  typingLabel?: string;
};

const minute = 60 * 1000;
const now = Date.now();

const baseConversations: StoredConversation[] = [
  {
    id: 'direct-sara',
    type: 'direct',
    title: 'Sara Khan',
    subtitle: 'Online now',
    avatarLabel: 'S',
    accent: '#4ed0a8',
    unreadCount: 2,
    memberCount: 2,
    presence: 'online',
    typingLabel: 'Typing a rollout note...',
  },
  {
    id: 'group-launch',
    type: 'group',
    title: 'Launch Core',
    subtitle: '5 members',
    avatarLabel: 'LC',
    accent: '#f8b35d',
    unreadCount: 0,
    memberCount: 5,
    presence: 'away',
  },
  {
    id: 'direct-milan',
    type: 'direct',
    title: 'Milan Patel',
    subtitle: 'Last seen 18m ago',
    avatarLabel: 'M',
    accent: '#8db8ff',
    unreadCount: 0,
    memberCount: 2,
    presence: 'offline',
  },
  {
    id: 'group-ops',
    type: 'group',
    title: 'Ops Bridge',
    subtitle: '8 members',
    avatarLabel: 'OB',
    accent: '#f28b82',
    unreadCount: 1,
    memberCount: 8,
    presence: 'online',
  },
];

const initialMessages: Record<string, StoredMessage[]> = {
  'direct-sara': [
    createSeedMessage(
      'direct-sara',
      'sara',
      'Sara Khan',
      'I reviewed the brief. We should keep the web app fast and chat-first.',
      now - 22 * minute,
      'read'
    ),
    createSeedMessage(
      'direct-sara',
      'viewer',
      'You',
      'Agreed. Phase 1 is auth, 1-on-1 chat, uploads, and presence.',
      now - 18 * minute,
      'read'
    ),
    createSeedMessage(
      'direct-sara',
      'sara',
      'Sara Khan',
      'I can prepare the UI states for unread, typing, and call entry.',
      now - 11 * minute,
      'read'
    ),
    createSeedMessage(
      'direct-sara',
      'viewer',
      'You',
      'Perfect. I am replacing the dashboard shell with a messaging workspace now.',
      now - 4 * minute,
      'delivered'
    ),
  ],
  'group-launch': [
    createSeedMessage(
      'group-launch',
      'nina',
      'Nina Roy',
      'Roadmap is aligned: MVP, group features, then calls.',
      now - 59 * minute,
      'read'
    ),
    createSeedMessage(
      'group-launch',
      'viewer',
      'You',
      'I am keeping env and deployment config, but the product surface is being rebuilt.',
      now - 45 * minute,
      'read'
    ),
    createSeedMessage(
      'group-launch',
      'omar',
      'Omar Lee',
      'We should add Redis before presence so the contracts stay stable.',
      now - 17 * minute,
      'delivered'
    ),
  ],
  'direct-milan': [
    createSeedMessage(
      'direct-milan',
      'milan',
      'Milan Patel',
      'For message history, cursor pagination is the right move.',
      now - 95 * minute,
      'read'
    ),
    createSeedMessage(
      'direct-milan',
      'viewer',
      'You',
      'Yes. I am pairing that with PostgreSQL summaries for the chat list.',
      now - 91 * minute,
      'read'
    ),
  ],
  'group-ops': [
    createSeedMessage(
      'group-ops',
      'ops',
      'Ops Bot',
      'Daily status: storage and notifications remain on the Phase 3 track.',
      now - 73 * minute,
      'read'
    ),
    createSeedMessage(
      'group-ops',
      'viewer',
      'You',
      'Noted. We will keep uploads signed and move heavy work into workers.',
      now - 67 * minute,
      'delivered'
    ),
  ],
};

let messageStore = clone(initialMessages);

function createSeedMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  body: string,
  createdAtMs: number,
  delivery: MessageDeliveryState
): StoredMessage {
  const id = `msg_${conversationId}_${createdAtMs}`;

  return {
    id,
    clientId: id,
    conversationId,
    senderId,
    senderName,
    body,
    kind: 'text',
    createdAt: new Date(createdAtMs).toISOString(),
    delivery,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function getViewer(viewerSession?: ViewerSession): MessagingViewer {
  const displayName = viewerSession?.name?.trim() || 'Workspace Owner';
  const firstLetter = displayName[0]?.toUpperCase() || 'W';

  return {
    id: viewerSession?.id || 'viewer-session',
    displayName,
    handle: `@${slugify(displayName)}`,
    avatarLabel: firstLetter,
    phoneLabel: '+91 phase-1-web',
    about: 'Building the new messaging core.',
  };
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

function getMessagesForConversation(conversationId: string): StoredMessage[] {
  return messageStore[conversationId] ? [...messageStore[conversationId]] : [];
}

function toPublicMessage(message: StoredMessage, viewer: MessagingViewer): MessagingMessage {
  const isViewer = message.senderId === 'viewer';

  return {
    id: message.id,
    clientId: message.clientId,
    conversationId: message.conversationId,
    senderId: isViewer ? viewer.id : message.senderId,
    senderName: isViewer ? viewer.displayName : message.senderName,
    body: message.body,
    kind: message.kind,
    createdAt: message.createdAt,
    createdAtLabel: formatClock(message.createdAt),
    delivery: message.delivery,
    direction: isViewer ? 'outgoing' : 'incoming',
  };
}

function buildConversationSummary(conversation: StoredConversation): ConversationSummary {
  const messages = getMessagesForConversation(conversation.id);
  const latestMessage = messages[messages.length - 1];
  const latestPreview = latestMessage
    ? latestMessage.senderId === 'viewer'
      ? `You: ${latestMessage.body}`
      : `${latestMessage.senderName}: ${latestMessage.body}`
    : 'No messages yet';

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    subtitle: conversation.subtitle,
    avatarLabel: conversation.avatarLabel,
    accent: conversation.accent,
    unreadCount: conversation.unreadCount,
    memberCount: conversation.memberCount,
    lastMessagePreview: latestPreview,
    lastActivityLabel: latestMessage ? formatRelative(latestMessage.createdAt) : 'now',
    presence: conversation.presence,
    typingLabel: conversation.typingLabel,
  };
}

export function getMessagingSnapshot(viewerSession?: ViewerSession): MessagingSnapshot {
  const viewer = getViewer(viewerSession);

  const conversations = [...baseConversations]
    .sort((left, right) => {
      const leftMessages = getMessagesForConversation(left.id);
      const rightMessages = getMessagesForConversation(right.id);
      const leftTime = leftMessages[leftMessages.length - 1]?.createdAt || '';
      const rightTime = rightMessages[rightMessages.length - 1]?.createdAt || '';

      return rightTime.localeCompare(leftTime);
    })
    .map((conversation) => buildConversationSummary(conversation));

  const messagesByConversation = conversations.reduce<Record<string, MessagingMessage[]>>(
    (accumulator, conversation) => {
      accumulator[conversation.id] = getMessagesForConversation(conversation.id).map((message) =>
        toPublicMessage(message, viewer)
      );
      return accumulator;
    },
    {}
  );

  return {
    viewer,
    conversations,
    messagesByConversation,
  };
}

export function getConversationMessages(
  conversationId: string,
  viewerSession?: ViewerSession
): MessagingMessage[] | null {
  const conversationExists = baseConversations.some((conversation) => conversation.id === conversationId);
  if (!conversationExists) {
    return null;
  }

  const viewer = getViewer(viewerSession);
  return getMessagesForConversation(conversationId).map((message) => toPublicMessage(message, viewer));
}

export function appendMessage(
  input: SendMessageInput,
  viewerSession?: ViewerSession
): { message: MessagingMessage; conversations: ConversationSummary[] } | null {
  const trimmedBody = input.body.trim();
  const conversationExists = baseConversations.some((conversation) => conversation.id === input.conversationId);

  if (!trimmedBody || !conversationExists) {
    return null;
  }

  const viewer = getViewer(viewerSession);
  const createdAt = new Date().toISOString();
  const id = `msg_${input.conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const storedMessage: StoredMessage = {
    id,
    clientId: id,
    conversationId: input.conversationId,
    senderId: 'viewer',
    senderName: viewer.displayName,
    body: trimmedBody,
    kind: 'text',
    createdAt,
    delivery: 'delivered',
  };

  messageStore = {
    ...messageStore,
    [input.conversationId]: [...getMessagesForConversation(input.conversationId), storedMessage],
  };

  return {
    message: toPublicMessage(storedMessage, viewer),
    conversations: getMessagingSnapshot(viewerSession).conversations,
  };
}
