import { getDatabaseClient } from '@/lib/postgres';
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

type ConversationRow = {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  created_at: string | Date;
  last_message_at: string | Date | null;
  member_count: number;
};

type MemberRow = {
  conversation_id: string;
  user_id: string;
  display_name: string;
  last_seen_at: string | Date | null;
};

type MessageRow = {
  id: string;
  client_id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string | null;
  created_at: string | Date;
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
      id: '11111111-1111-4111-8111-111111111111',
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
      id: '22222222-2222-4222-8222-222222222222',
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
      id: '33333333-3333-4333-8333-333333333333',
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
          body: 'Yes. I am pairing that with PostgreSQL summaries for the chat list.',
          minutesAgo: 91,
        },
      ],
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
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

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
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

async function ensureStarterData(
  sql: NonNullable<ReturnType<typeof getDatabaseClient>>,
  viewerSession?: ViewerSession
): Promise<void> {
  const viewer = makeViewer(viewerSession);

  await sql`
    insert into app_users (id, username, display_name, about, last_seen_at)
    values (${viewer.id}, ${viewer.handle.slice(1)}, ${viewer.displayName}, ${viewer.about}, now())
    on conflict (id) do update
    set display_name = excluded.display_name,
        username = excluded.username,
        about = excluded.about,
        last_seen_at = now(),
        updated_at = now()
  `;

  const membershipCountRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from conversation_members
    where user_id = ${viewer.id}
  `;

  if ((membershipCountRows[0]?.count || 0) > 0) {
    return;
  }

  for (const contact of seedContacts) {
    const lastSeenAt = new Date(Date.now() - contact.lastSeenMinutesAgo * minute).toISOString();

    await sql`
      insert into app_users (id, phone_e164, username, display_name, about, last_seen_at)
      values (
        ${contact.id},
        ${contact.phoneLabel},
        ${contact.username},
        ${contact.displayName},
        ${contact.about},
        ${lastSeenAt}
      )
      on conflict (id) do update
      set display_name = excluded.display_name,
          username = excluded.username,
          about = excluded.about,
          last_seen_at = excluded.last_seen_at,
          updated_at = now()
    `;
  }

  const conversations = buildSeedConversations(viewer.id, viewer.displayName);

  for (const conversation of conversations) {
    await sql`
      insert into conversations (id, type, title, created_by, created_at, updated_at)
      values (
        ${conversation.id}::uuid,
        ${conversation.type},
        ${conversation.title},
        ${viewer.id},
        now(),
        now()
      )
      on conflict (id) do nothing
    `;

    for (const memberId of conversation.memberIds) {
      await sql`
        insert into conversation_members (conversation_id, user_id, role)
        values (${conversation.id}::uuid, ${memberId}, 'member')
        on conflict (conversation_id, user_id) do nothing
      `;
    }

    let latestMessageId: string | null = null;
    let latestCreatedAt: string | null = null;

    for (let index = 0; index < conversation.messages.length; index += 1) {
      const message = conversation.messages[index];
      const createdAt = new Date(Date.now() - message.minutesAgo * minute).toISOString();
      const clientId = `seed.${conversation.id}.${index}`;

      const insertedRows = await sql<{ id: string }[]>`
        insert into messages (
          client_id,
          conversation_id,
          sender_user_id,
          kind,
          plaintext_preview,
          created_at
        )
        values (
          ${clientId},
          ${conversation.id}::uuid,
          ${message.senderId},
          'text',
          ${message.body},
          ${createdAt}
        )
        on conflict (client_id) do update
        set plaintext_preview = excluded.plaintext_preview
        returning id::text as id
      `;

      latestMessageId = insertedRows[0]?.id || latestMessageId;
      latestCreatedAt = createdAt;
    }

    if (latestMessageId && latestCreatedAt) {
      await sql`
        update conversations
        set last_message_id = ${latestMessageId}::uuid,
            last_message_at = ${latestCreatedAt},
            updated_at = now()
        where id = ${conversation.id}::uuid
      `;
    }
  }
}

async function getDatabaseSnapshot(
  sql: NonNullable<ReturnType<typeof getDatabaseClient>>,
  viewerSession?: ViewerSession
): Promise<MessagingSnapshot> {
  const viewer = makeViewer(viewerSession);

  await ensureStarterData(sql, viewerSession);

  const conversationRows = await sql<ConversationRow[]>`
    select
      c.id::text as id,
      c.type,
      c.title,
      c.created_at,
      c.last_message_at,
      count(all_members.user_id)::int as member_count
    from conversations c
    join conversation_members self_member
      on self_member.conversation_id = c.id
     and self_member.user_id = ${viewer.id}
    join conversation_members all_members
      on all_members.conversation_id = c.id
    group by c.id, c.type, c.title, c.created_at, c.last_message_at
    order by coalesce(c.last_message_at, c.created_at) desc
  `;

  if (conversationRows.length === 0) {
    return getMockMessagingSnapshot(viewerSession);
  }

  const conversationIds = conversationRows.map((conversation) => conversation.id);

  const memberRows = await sql<MemberRow[]>`
    select
      cm.conversation_id::text as conversation_id,
      u.id as user_id,
      u.display_name,
      u.last_seen_at
    from conversation_members cm
    join app_users u on u.id = cm.user_id
    where cm.conversation_id in ${sql(conversationIds)}
  `;

  const messageRows = await sql<MessageRow[]>`
    select
      m.id::text as id,
      m.client_id,
      m.conversation_id::text as conversation_id,
      m.sender_user_id,
      u.display_name as sender_name,
      coalesce(m.plaintext_preview, '') as body,
      m.created_at
    from messages m
    join app_users u on u.id = m.sender_user_id
    where m.conversation_id in ${sql(conversationIds)}
      and m.deleted_at is null
    order by m.created_at asc
  `;

  const membersByConversation = memberRows.reduce<Record<string, MemberRow[]>>((accumulator, row) => {
    accumulator[row.conversation_id] = [...(accumulator[row.conversation_id] || []), row];
    return accumulator;
  }, {});

  const messagesByConversationRows = messageRows.reduce<Record<string, MessageRow[]>>((accumulator, row) => {
    accumulator[row.conversation_id] = [...(accumulator[row.conversation_id] || []), row];
    return accumulator;
  }, {});

  const messagesByConversation = conversationRows.reduce<Record<string, MessagingMessage[]>>(
    (accumulator, conversation) => {
      const rows = messagesByConversationRows[conversation.id] || [];

      accumulator[conversation.id] = rows.map((message) => {
        const createdAt = toIso(message.created_at) || new Date().toISOString();
        const isViewer = message.sender_user_id === viewer.id;

        return {
          id: message.id,
          clientId: message.client_id,
          conversationId: message.conversation_id,
          senderId: message.sender_user_id,
          senderName: message.sender_name,
          body: message.body || '',
          kind: 'text',
          createdAt,
          createdAtLabel: formatClock(createdAt),
          delivery: isViewer ? 'delivered' : 'read',
          direction: isViewer ? 'outgoing' : 'incoming',
        };
      });

      return accumulator;
    },
    {}
  );

  const conversations = conversationRows.map((conversation) => {
    const members = membersByConversation[conversation.id] || [];
    const otherMember = members.find((member) => member.user_id !== viewer.id);
    const latestMessage = messagesByConversation[conversation.id]?.slice(-1)[0];
    const otherLastSeen = toIso(otherMember?.last_seen_at || null);
    const title =
      conversation.type === 'direct'
        ? otherMember?.display_name || conversation.title || 'Direct chat'
        : conversation.title || 'Group chat';

    return {
      id: conversation.id,
      type: conversation.type,
      title,
      subtitle:
        conversation.type === 'direct'
          ? getDirectSubtitle(otherLastSeen)
          : `${conversation.member_count} members`,
      avatarLabel: deriveAvatarLabel(title),
      accent: getAccent(conversation.id),
      unreadCount: 0,
      memberCount: conversation.member_count,
      lastMessagePreview: latestMessage
        ? latestMessage.direction === 'outgoing'
          ? `You: ${latestMessage.body}`
          : `${latestMessage.senderName}: ${latestMessage.body}`
        : 'No messages yet',
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

async function insertDatabaseMessage(
  sql: NonNullable<ReturnType<typeof getDatabaseClient>>,
  input: SendMessageInput,
  viewerSession?: ViewerSession
): Promise<{ message: MessagingMessage; conversations: ConversationSummary[] } | null> {
  const viewer = makeViewer(viewerSession);

  await ensureStarterData(sql, viewerSession);

  const membershipRows = await sql<{ exists: boolean }[]>`
    select true as exists
    from conversation_members
    where conversation_id = ${input.conversationId}::uuid
      and user_id = ${viewer.id}
    limit 1
  `;

  if (!membershipRows[0]?.exists) {
    return null;
  }

  const trimmedBody = input.body.trim();
  if (!trimmedBody) {
    return null;
  }

  const clientId = `live.${crypto.randomUUID()}`;
  const insertedRows = await sql<MessageRow[]>`
    insert into messages (
      client_id,
      conversation_id,
      sender_user_id,
      kind,
      plaintext_preview,
      created_at
    )
    values (
      ${clientId},
      ${input.conversationId}::uuid,
      ${viewer.id},
      'text',
      ${trimmedBody},
      now()
    )
    returning
      id::text as id,
      client_id,
      conversation_id::text as conversation_id,
      sender_user_id,
      ${viewer.displayName} as sender_name,
      plaintext_preview as body,
      created_at
  `;

  const inserted = insertedRows[0];
  if (!inserted) {
    return null;
  }

  await sql`
    update conversations
    set last_message_id = ${inserted.id}::uuid,
        last_message_at = ${toIso(inserted.created_at)},
        updated_at = now()
    where id = ${inserted.conversation_id}::uuid
  `;

  const snapshot = await getDatabaseSnapshot(sql, viewerSession);
  const createdAt = toIso(inserted.created_at) || new Date().toISOString();

  return {
    message: {
      id: inserted.id,
      clientId: inserted.client_id,
      conversationId: inserted.conversation_id,
      senderId: viewer.id,
      senderName: viewer.displayName,
      body: inserted.body || '',
      kind: 'text',
      createdAt,
      createdAtLabel: formatClock(createdAt),
      delivery: 'delivered',
      direction: 'outgoing',
    },
    conversations: snapshot.conversations,
  };
}

export async function loadMessagingSnapshot(viewerSession?: ViewerSession): Promise<MessagingSnapshot> {
  const sql = getDatabaseClient();

  if (!sql) {
    return getMockMessagingSnapshot(viewerSession);
  }

  try {
    return await getDatabaseSnapshot(sql, viewerSession);
  } catch (error) {
    console.error('[messaging-store] snapshot fallback:', error);
    return getMockMessagingSnapshot(viewerSession);
  }
}

export async function loadConversationMessages(
  conversationId: string,
  viewerSession?: ViewerSession
): Promise<MessagingMessage[] | null> {
  const sql = getDatabaseClient();

  if (!sql) {
    return getMockConversationMessages(conversationId, viewerSession);
  }

  try {
    const snapshot = await getDatabaseSnapshot(sql, viewerSession);
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
  const sql = getDatabaseClient();

  if (!sql) {
    return appendMockMessage(input, viewerSession);
  }

  try {
    return await insertDatabaseMessage(sql, input, viewerSession);
  } catch (error) {
    console.error('[messaging-store] message fallback:', error);
    return appendMockMessage(input, viewerSession);
  }
}
