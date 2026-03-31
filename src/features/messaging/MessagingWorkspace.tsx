'use client';

import { useDeferredValue, useState, useTransition } from 'react';
import { signOut } from 'next-auth/react';
import styles from './MessagingWorkspace.module.css';
import type { ConversationSummary, MessagingMessage, MessagingSnapshot } from './types';

type MessageCreateResponse = {
  message: MessagingMessage;
  conversations: ConversationSummary[];
};

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function reorderConversations(
  conversations: ConversationSummary[],
  conversationId: string,
  preview: string
): ConversationSummary[] {
  const updated = conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          lastMessagePreview: preview,
          lastActivityLabel: 'now',
          unreadCount: 0,
        }
      : conversation
  );

  return updated.sort((left, right) => {
    if (left.id === conversationId) {
      return -1;
    }

    if (right.id === conversationId) {
      return 1;
    }

    return 0;
  });
}

function insertMessage(snapshot: MessagingSnapshot, message: MessagingMessage): MessagingSnapshot {
  const currentMessages = snapshot.messagesByConversation[message.conversationId] || [];
  const nextMessages = [...currentMessages, message];
  const nextConversations = reorderConversations(
    snapshot.conversations,
    message.conversationId,
    `You: ${message.body}`
  );

  return {
    ...snapshot,
    conversations: nextConversations,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [message.conversationId]: nextMessages,
    },
  };
}

function replaceMessage(
  snapshot: MessagingSnapshot,
  conversationId: string,
  temporaryId: string,
  message: MessagingMessage,
  conversations: ConversationSummary[]
): MessagingSnapshot {
  const nextMessages = (snapshot.messagesByConversation[conversationId] || []).map((item) =>
    item.id === temporaryId ? message : item
  );

  return {
    ...snapshot,
    conversations,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [conversationId]: nextMessages,
    },
  };
}

function removeMessage(
  snapshot: MessagingSnapshot,
  conversationId: string,
  temporaryId: string
): MessagingSnapshot {
  const nextMessages = (snapshot.messagesByConversation[conversationId] || []).filter(
    (message) => message.id !== temporaryId
  );

  return {
    ...snapshot,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [conversationId]: nextMessages,
    },
  };
}

export default function MessagingWorkspace({
  initialSnapshot,
}: {
  initialSnapshot: MessagingSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialSnapshot.conversations[0]?.id || ''
  );
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const normalizedQuery = deferredSearch.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? snapshot.conversations.filter((conversation) => {
        const haystack =
          `${conversation.title} ${conversation.subtitle} ${conversation.lastMessagePreview}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : snapshot.conversations;

  const activeConversation =
    snapshot.conversations.find((conversation) => conversation.id === selectedConversationId) ||
    snapshot.conversations[0];

  const visibleMessages = activeConversation
    ? snapshot.messagesByConversation[activeConversation.id] || []
    : [];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeConversation) {
      return;
    }

    const body = draft.trim();
    if (!body) {
      return;
    }

    const createdAt = new Date().toISOString();
    const optimisticId = `temp_${Date.now()}`;
    const optimisticMessage: MessagingMessage = {
      id: optimisticId,
      clientId: optimisticId,
      conversationId: activeConversation.id,
      senderId: snapshot.viewer.id,
      senderName: snapshot.viewer.displayName,
      body,
      kind: 'text',
      createdAt,
      createdAtLabel: formatClock(createdAt),
      delivery: 'sent',
      direction: 'outgoing',
    };

    setError('');
    setDraft('');
    setSnapshot((current) => insertMessage(current, optimisticMessage));

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch('/api/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: activeConversation.id,
              body,
            }),
          });

          if (!response.ok) {
            throw new Error('send_failed');
          }

          const payload = (await response.json()) as MessageCreateResponse;

          setSnapshot((current) =>
            replaceMessage(current, activeConversation.id, optimisticId, payload.message, payload.conversations)
          );
        } catch {
          setSnapshot((current) => removeMessage(current, activeConversation.id, optimisticId));
          setDraft(body);
          setError('Message could not be sent. Try again in a moment.');
        }
      })();
    });
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.rail}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>{snapshot.viewer.avatarLabel}</span>
          <div>
            <p className={styles.brandEyebrow}>Messaging rebuild</p>
            <h1 className={styles.brandTitle}>Phase 1</h1>
          </div>
        </div>

        <nav className={styles.railNav}>
          <button type="button" className={styles.railActionActive}>
            <span>Chats</span>
            <small>Live</small>
          </button>
          <button type="button" className={styles.railAction}>
            <span>Calls</span>
            <small>Soon</small>
          </button>
          <button type="button" className={styles.railAction}>
            <span>Media</span>
            <small>Phase 1</small>
          </button>
          <button type="button" className={styles.railAction}>
            <span>Devices</span>
            <small>Roadmap</small>
          </button>
        </nav>

        <button
          type="button"
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign out
        </button>
      </aside>

      <section className={styles.listColumn}>
        <div className={styles.viewerCard}>
          <div className={styles.viewerAvatar}>{snapshot.viewer.avatarLabel}</div>
          <div>
            <h2>{snapshot.viewer.displayName}</h2>
            <p>
              {snapshot.viewer.handle} | {snapshot.viewer.phoneLabel}
            </p>
          </div>
        </div>

        <div className={styles.searchCard}>
          <label htmlFor="chat-search" className={styles.searchLabel}>
            Search conversations
          </label>
          <input
            id="chat-search"
            className={styles.searchInput}
            placeholder="Search by name, team, or message"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Inbox</p>
            <h3>{snapshot.conversations.length} active threads</h3>
          </div>
          <span className={styles.statusPill}>Socket-ready</span>
        </div>

        <div className={styles.conversationList}>
          {filteredConversations.map((conversation) => {
            const isActive = conversation.id === activeConversation?.id;

            return (
              <button
                key={conversation.id}
                type="button"
                className={isActive ? styles.conversationActive : styles.conversation}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <span
                  className={styles.conversationAvatar}
                  style={{ backgroundColor: conversation.accent }}
                >
                  {conversation.avatarLabel}
                </span>
                <div className={styles.conversationMeta}>
                  <div className={styles.conversationRow}>
                    <strong>{conversation.title}</strong>
                    <span>{conversation.lastActivityLabel}</span>
                  </div>
                  <p>{conversation.typingLabel || conversation.lastMessagePreview}</p>
                  <div className={styles.conversationFooter}>
                    <span>{conversation.subtitle}</span>
                    {conversation.unreadCount > 0 ? (
                      <span className={styles.unreadBadge}>{conversation.unreadCount}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.chatColumn}>
        {activeConversation ? (
          <>
            <header className={styles.chatHeader}>
              <div className={styles.chatIdentity}>
                <span
                  className={styles.chatAvatar}
                  style={{ backgroundColor: activeConversation.accent }}
                >
                  {activeConversation.avatarLabel}
                </span>
                <div>
                  <h2>{activeConversation.title}</h2>
                  <p>{activeConversation.typingLabel || activeConversation.subtitle}</p>
                </div>
              </div>

              <div className={styles.chatActions}>
                <span className={styles.actionChip}>Uploads</span>
                <span className={styles.actionChip}>Presence</span>
                <span className={styles.actionChipMuted}>Calls next</span>
              </div>
            </header>

            <div className={styles.messageStream}>
              {visibleMessages.map((message) => (
                <article
                  key={message.id}
                  className={message.direction === 'outgoing' ? styles.outgoing : styles.incoming}
                >
                  <div className={styles.messageBubble}>
                    {message.direction === 'incoming' ? (
                      <p className={styles.messageSender}>{message.senderName}</p>
                    ) : null}
                    <p className={styles.messageBody}>{message.body}</p>
                    <div className={styles.messageMeta}>
                      <span>{message.createdAtLabel}</span>
                      <span>{message.delivery}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <form className={styles.composer} onSubmit={handleSubmit}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={styles.composerInput}
                placeholder={`Message ${activeConversation.title}`}
                rows={1}
              />
              <button type="submit" className={styles.sendButton} disabled={isPending || !draft.trim()}>
                {isPending ? 'Sending...' : 'Send'}
              </button>
            </form>

            {error ? <p className={styles.error}>{error}</p> : null}
          </>
        ) : (
          <div className={styles.emptyState}>
            <h2>No conversation selected</h2>
            <p>Choose a thread from the inbox to start testing the new workspace.</p>
          </div>
        )}
      </section>

      <aside className={styles.detailColumn}>
        <div className={styles.detailCard}>
          <p className={styles.sectionEyebrow}>Build status</p>
          <h3>Phase 1 foundation</h3>
          <p>
            This workspace is now aligned to the new product model: direct chat, group chat,
            uploads, and real-time presence before calls.
          </p>
          <div className={styles.stackList}>
            <span>Next.js 16</span>
            <span>Socket.IO</span>
            <span>PostgreSQL</span>
            <span>Redis</span>
            <span>LiveKit</span>
          </div>
        </div>

        <div className={styles.detailCard}>
          <p className={styles.sectionEyebrow}>Current thread</p>
          <h3>{activeConversation?.title || 'Inbox'}</h3>
          <ul className={styles.detailList}>
            <li>Type: {activeConversation?.type || 'direct'}</li>
            <li>Members: {activeConversation?.memberCount || 0}</li>
            <li>Presence: {activeConversation?.presence || 'offline'}</li>
            <li>Unread: {activeConversation?.unreadCount || 0}</li>
          </ul>
        </div>

        <div className={styles.detailCard}>
          <p className={styles.sectionEyebrow}>Next delivery slice</p>
          <h3>Database and transport</h3>
          <ul className={styles.detailList}>
            <li>Wire these contracts to PostgreSQL tables.</li>
            <li>Move message send from mock store to durable API writes.</li>
            <li>Add Redis-backed presence and typing events.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
